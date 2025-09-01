package com.vpnbrowser.core

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.vpnbrowser.api.ApiService
import com.vpnbrowser.api.ApiResult
import kotlinx.coroutines.*

/**
 * 节点自动获取管理器
 * 负责从后端自动获取和更新节点配置
 */
class NodeAutoFetcher(private val context: Context) {
    companion object {
        private const val TAG = "NodeAutoFetcher"
        private const val PREFS_NAME = "node_auto_fetcher"
        private const val KEY_LAST_FETCH = "last_fetch"
        private const val KEY_AUTO_FETCH_ENABLED = "auto_fetch_enabled"
        private const val FETCH_INTERVAL = 6 * 60 * 60 * 1000L // 6小时更新一次
    }
    
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    /**
     * 检查是否需要获取节点
     */
    fun shouldFetchNodes(): Boolean {
        if (!isAutoFetchEnabled()) {
            return false
        }
        
        val lastFetch = prefs.getLong(KEY_LAST_FETCH, 0)
        return System.currentTimeMillis() - lastFetch > FETCH_INTERVAL
    }
    
    /**
     * 是否启用自动获取
     */
    fun isAutoFetchEnabled(): Boolean {
        return prefs.getBoolean(KEY_AUTO_FETCH_ENABLED, true) // 默认启用
    }
    
    /**
     * 设置自动获取开关
     */
    fun setAutoFetchEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_AUTO_FETCH_ENABLED, enabled).apply()
        Log.i(TAG, "自动获取节点${if (enabled) "已启用" else "已禁用"}")
    }
    
    /**
     * 从服务器获取节点配置
     */
    suspend fun fetchNodesFromServer(
        apiService: ApiService,
        nodePool: NodePool,
        replaceExisting: Boolean = false
    ): FetchResult {
        return try {
            Log.i(TAG, "开始从服务器获取节点配置")
            
            val result = apiService.getNodeConfigs()
            
            when (result) {
                is ApiResult.Success -> {
                    val nodes = result.data
                    Log.i(TAG, "从服务器获取到${nodes.size}个节点")
                    
                    if (replaceExisting) {
                        // 清除现有节点，使用服务器节点
                        clearAndAddNodes(nodePool, nodes)
                    } else {
                        // 合并节点，避免重复
                        mergeNodes(nodePool, nodes)
                    }
                    
                    // 更新最后获取时间
                    prefs.edit().putLong(KEY_LAST_FETCH, System.currentTimeMillis()).apply()
                    
                    FetchResult.Success(nodes.size)
                }
                is ApiResult.Error -> {
                    Log.w(TAG, "从服务器获取节点失败: ${result.message}")
                    FetchResult.Error(result.message)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "获取节点配置异常", e)
            FetchResult.Error("获取节点异常: ${e.message}")
        }
    }
    
    /**
     * 自动获取节点（如果需要）
     */
    suspend fun autoFetchIfNeeded(
        apiService: ApiService,
        nodePool: NodePool
    ): FetchResult {
        return if (shouldFetchNodes()) {
            Log.i(TAG, "检测到需要自动获取节点")
            fetchNodesFromServer(apiService, nodePool, replaceExisting = false)
        } else {
            Log.d(TAG, "节点仍在缓存期内或自动获取已禁用，无需更新")
            FetchResult.Success(0)
        }
    }
    
    /**
     * 清除并添加新节点
     */
    private fun clearAndAddNodes(nodePool: NodePool, nodes: List<ProxyNode>) {
        // 注意：这里不清除手动添加的节点，只清除自动获取的节点
        val existingNodes = nodePool.getAllNodes()
        val manualNodes = existingNodes.filter { it.id.startsWith("manual-") }
        
        // 清除所有节点
        nodePool.clearAllNodes()
        
        // 重新添加手动节点
        manualNodes.forEach { nodePool.addNode(it) }
        
        // 添加服务器节点
        nodes.forEach { node ->
            val serverNode = node.copy(id = "server-${node.id}")
            nodePool.addNode(serverNode)
        }
        
        Log.i(TAG, "已替换节点配置：保留${manualNodes.size}个手动节点，添加${nodes.size}个服务器节点")
    }
    
    /**
     * 合并节点，避免重复
     */
    private fun mergeNodes(nodePool: NodePool, nodes: List<ProxyNode>) {
        val existingNodes = nodePool.getAllNodes()
        val existingAddresses = existingNodes.map { "${it.address}:${it.port}" }.toSet()
        
        var addedCount = 0
        nodes.forEach { node ->
            val nodeAddress = "${node.address}:${node.port}"
            if (!existingAddresses.contains(nodeAddress)) {
                val serverNode = node.copy(id = "server-${System.currentTimeMillis()}-${addedCount}")
                nodePool.addNode(serverNode)
                addedCount++
            }
        }
        
        Log.i(TAG, "合并节点完成：新增${addedCount}个节点，跳过${nodes.size - addedCount}个重复节点")
    }
    
    /**
     * 强制刷新节点
     */
    suspend fun forceRefreshNodes(
        apiService: ApiService,
        nodePool: NodePool,
        replaceExisting: Boolean = false
    ): FetchResult {
        Log.i(TAG, "强制刷新节点配置")
        return fetchNodesFromServer(apiService, nodePool, replaceExisting)
    }
    
    /**
     * 获取最后更新时间
     */
    fun getLastFetchTime(): Long {
        return prefs.getLong(KEY_LAST_FETCH, 0)
    }
    
    /**
     * 获取下次更新时间
     */
    fun getNextFetchTime(): Long {
        return getLastFetchTime() + FETCH_INTERVAL
    }
    
    /**
     * 清除缓存
     */
    fun clearCache() {
        prefs.edit()
            .remove(KEY_LAST_FETCH)
            .apply()
        Log.i(TAG, "节点获取缓存已清除")
    }
    
    fun destroy() {
        scope.cancel()
        Log.i(TAG, "NodeAutoFetcher销毁")
    }
}

/**
 * 节点获取结果
 */
sealed class FetchResult {
    data class Success(val nodeCount: Int) : FetchResult()
    data class Error(val message: String) : FetchResult()
    
    fun isSuccess(): Boolean = this is Success
    fun isError(): Boolean = this is Error
}

/**
 * NodePool扩展方法
 */
fun NodePool.clearAllNodes() {
    // 注意：这个方法需要在NodePool中实现
    // 这里只是预留接口
}
