package com.vpnbrowser.core

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

/**
 * 节点池管理器
 * 负责管理所有代理节点的状态、健康检查和选择
 */
class NodePool(private val context: Context) {
    companion object {
        private const val TAG = "NodePool"
    }
    private val gson = Gson()
    private val prefs: SharedPreferences = context.getSharedPreferences("node_pool", Context.MODE_PRIVATE)
    
    // 使用线程安全的集合和读写锁
    private val allNodes = ConcurrentHashMap<String, ProxyNode>()
    private val healthyNodes = mutableSetOf<ProxyNode>()
    private val lock = ReentrantReadWriteLock()
    
    // 协程作用域
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    init {
        loadNodesFromStorage()
    }
    
    /**
     * 添加节点
     */
    @Suppress("unused")
    fun addNode(node: ProxyNode) {
        lock.write {
            allNodes[node.id] = node
            if (node.isHealthy) {
                healthyNodes.add(node)
            }
        }
        saveNodesToStorage()
        Log.d(TAG, "添加节点: ${node.name}")
    }
    
    /**
     * 批量添加节点
     */
    fun addNodes(nodes: List<ProxyNode>) {
        lock.write {
            nodes.forEach { node ->
                allNodes[node.id] = node
                if (node.isHealthy) {
                    healthyNodes.add(node)
                }
            }
        }
        saveNodesToStorage()
        Log.d(TAG, "批量添加节点: ${nodes.size}个")
    }
    
    /**
     * 获取所有节点
     */
    fun getAllNodes(): List<ProxyNode> {
        return lock.read {
            allNodes.values.toList()
        }
    }
    
    /**
     * 获取健康节点
     */
    fun getHealthyNodes(): List<ProxyNode> {
        return lock.read {
            healthyNodes.toList().sortedBy { it.latency }
        }
    }
    
    /**
     * 获取最优节点
     */
    fun getOptimalNode(): ProxyNode? {
        return lock.read {
            healthyNodes.maxByOrNull { it.getPerformanceScore() }
        }
    }
    
    /**
     * 根据ID获取节点
     */
    @Suppress("unused")
    fun getNodeById(nodeId: String): ProxyNode? {
        return allNodes[nodeId]
    }
    
    /**
     * 标记节点为不健康
     */
    fun markNodeUnhealthy(nodeId: String, error: String? = null) {
        lock.write {
            allNodes[nodeId]?.let { node ->
                node.isHealthy = false
                node.failureCount++
                healthyNodes.remove(node)
                Log.w(TAG, "节点不健康: ${node.name}, 错误: $error")
            }
        }
        saveNodesToStorage()
    }
    
    /**
     * 标记节点为健康
     */
    fun markNodeHealthy(nodeId: String) {
        lock.write {
            allNodes[nodeId]?.let { node ->
                node.isHealthy = true
                node.failureCount = 0
                if (!healthyNodes.contains(node)) {
                    healthyNodes.add(node)
                }
                Log.d(TAG, "节点恢复健康: ${node.name}")
            }
        }
        saveNodesToStorage()
    }
    
    /**
     * 更新节点延迟
     */
    fun updateNodeLatency(nodeId: String, latency: Long) {
        allNodes[nodeId]?.let { node ->
            node.latency = latency
            Log.d(TAG, "更新节点延迟: ${node.name} = ${latency}ms")
        }
    }
    
    /**
     * 记录节点请求结果
     */
    fun recordNodeRequest(nodeId: String, success: Boolean, responseTime: Long = 0) {
        allNodes[nodeId]?.let { node ->
            node.recordRequest(success, responseTime)
            
            // 根据连续失败次数判断是否标记为不健康
            if (!success && node.failureCount >= 3) {
                markNodeUnhealthy(nodeId, "连续失败${node.failureCount}次")
            } else if (success && !node.isHealthy && node.failureCount == 0) {
                markNodeHealthy(nodeId)
            }
        }
        saveNodesToStorage()
    }
    
    /**
     * 获取节点统计信息
     */
    fun getNodeStats(): Map<String, Any> {
        return lock.read {
            hashMapOf<String, Any>(
                "totalNodes" to allNodes.size,
                "healthyNodes" to healthyNodes.size,
                "avgLatency" to (healthyNodes.map { it.latency }.average().takeIf { !it.isNaN() } ?: 0.0),
                "bestLatency" to (healthyNodes.minOfOrNull { it.latency } ?: 0L),
                "worstLatency" to (healthyNodes.maxOfOrNull { it.latency } ?: 0L)
            )
        }
    }
    
    /**
     * 清理失效节点
     */
    fun cleanupFailedNodes() {
        val currentTime = System.currentTimeMillis()
        val cleanupThreshold = 24 * 60 * 60 * 1000L // 24小时
        
        lock.write {
            val toRemove = allNodes.values.filter { node ->
                !node.isHealthy && 
                node.failureCount > 10 && 
                (currentTime - node.lastChecked) > cleanupThreshold
            }
            
            toRemove.forEach { node ->
                allNodes.remove(node.id)
                healthyNodes.remove(node)
                Log.d(TAG, "清理失效节点: ${node.name}")
            }
        }
        
        if (allNodes.isNotEmpty()) {
            saveNodesToStorage()
        }
    }
    
    /**
     * 清除所有节点
     */
    fun clearAllNodes() {
        lock.write {
            val nodeCount = allNodes.size
            allNodes.clear()
            healthyNodes.clear()
            saveNodesToStorage()
            Log.i(TAG, "已清除所有节点，共${nodeCount}个")
        }
    }
    
    /**
     * 保存节点到本地存储
     */
    private fun saveNodesToStorage() {
        scope.launch {
            try {
                val nodesJson = gson.toJson(allNodes.values.toList())
                prefs.edit().putString("nodes", nodesJson).apply()
            } catch (e: Exception) {
                Log.e(TAG, "保存节点失败", e)
            }
        }
    }
    
    /**
     * 从本地存储加载节点
     */
    private fun loadNodesFromStorage() {
        try {
            val nodesJson = prefs.getString("nodes", null)
            if (!nodesJson.isNullOrEmpty()) {
                val type = object : TypeToken<List<ProxyNode>>() {}.type
                val nodes: List<ProxyNode> = gson.fromJson(nodesJson, type)
                
                lock.write {
                    allNodes.clear()
                    healthyNodes.clear()
                    
                    nodes.forEach { node ->
                        allNodes[node.id] = node
                        if (node.isHealthy) {
                            healthyNodes.add(node)
                        }
                    }
                }
                
                Log.d(TAG, "从存储加载节点: ${nodes.size}个")
            }
        } catch (e: Exception) {
            Log.e(TAG, "加载节点失败", e)
        }
    }
    
    /**
     * 销毁资源
     */
    fun destroy() {
        scope.cancel()
    }
}
