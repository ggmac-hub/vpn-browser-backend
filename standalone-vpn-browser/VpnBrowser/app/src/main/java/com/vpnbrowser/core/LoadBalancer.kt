package com.vpnbrowser.core

import android.util.Log
import kotlinx.coroutines.*
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.exp
import kotlin.random.Random

/**
 * 负载均衡器
 * 实现智能节点选择算法，支持加权轮询、延迟优化和动态权重调整
 */
class LoadBalancer {
    companion object {
        private const val TAG = "LoadBalancer"
    }
    
    // 轮询计数器
    private val roundRobinCounter = AtomicInteger(0)
    
    // 节点权重缓存
    private val nodeWeights = mutableMapOf<String, Int>()
    
    // 选择策略
    enum class SelectionStrategy {
        WEIGHTED_ROUND_ROBIN,    // 加权轮询
        LATENCY_BASED,           // 基于延迟
        PERFORMANCE_BASED,       // 基于性能评分
        HYBRID                   // 混合策略（推荐）
    }
    
    /**
     * 选择最优节点
     */
    fun selectOptimalNode(
        nodes: List<ProxyNode>, 
        strategy: SelectionStrategy = SelectionStrategy.HYBRID
    ): ProxyNode? {
        if (nodes.isEmpty()) {
            Log.w(TAG, "没有可用节点")
            return null
        }
        
        if (nodes.size == 1) {
            return nodes.first()
        }
        
        return when (strategy) {
            SelectionStrategy.WEIGHTED_ROUND_ROBIN -> weightedRoundRobin(nodes)
            SelectionStrategy.LATENCY_BASED -> latencyBasedSelection(nodes)
            SelectionStrategy.PERFORMANCE_BASED -> performanceBasedSelection(nodes)
            SelectionStrategy.HYBRID -> hybridSelection(nodes)
        }
    }
    
    /**
     * 混合策略选择（推荐）
     * 结合延迟、成功率和权重的智能选择
     */
    private fun hybridSelection(nodes: List<ProxyNode>): ProxyNode {
        // 1. 过滤出低延迟节点（前50%或延迟<1000ms）
        val sortedByLatency = nodes.sortedBy { it.latency }
        val latencyThreshold = minOf(1000L, sortedByLatency[sortedByLatency.size / 2].latency)
        val lowLatencyNodes = sortedByLatency.filter { it.latency <= latencyThreshold }
        
        if (lowLatencyNodes.isEmpty()) {
            Log.w(TAG, "没有低延迟节点，使用延迟最低的节点")
            return sortedByLatency.first()
        }
        
        // 2. 在低延迟节点中基于性能评分选择
        val candidateNodes = if (lowLatencyNodes.size <= 3) {
            lowLatencyNodes
        } else {
            // 如果低延迟节点太多，选择性能评分前3的节点
            lowLatencyNodes.sortedByDescending { it.getPerformanceScore() }.take(3)
        }
        
        // 3. 在候选节点中进行加权随机选择
        return weightedRandomSelection(candidateNodes)
    }
    
    /**
     * 基于延迟的选择
     */
    private fun latencyBasedSelection(nodes: List<ProxyNode>): ProxyNode {
        // 选择延迟最低的节点，但加入一定随机性避免单点过载
        val sortedNodes = nodes.sortedBy { it.latency }
        val topNodes = sortedNodes.take(minOf(3, sortedNodes.size))
        
        return if (topNodes.size == 1) {
            topNodes.first()
        } else {
            // 在前几个节点中随机选择，延迟越低权重越高
            val weights = topNodes.map { node ->
                val maxLatency = topNodes.maxOf { it.latency }
                val weight = if (maxLatency > 0) {
                    ((maxLatency - node.latency + 1).toDouble() / maxLatency * 100).toInt()
                } else {
                    100
                }
                maxOf(1, weight)
            }
            
            val totalWeight = weights.sum()
            val random = Random.nextInt(totalWeight)
            var currentWeight = 0
            
            for (i in topNodes.indices) {
                currentWeight += weights[i]
                if (random < currentWeight) {
                    return topNodes[i]
                }
            }
            
            topNodes.first()
        }
    }
    
    /**
     * 基于性能评分的选择
     */
    private fun performanceBasedSelection(nodes: List<ProxyNode>): ProxyNode {
        return nodes.maxByOrNull { it.getPerformanceScore() } ?: nodes.first()
    }
    
    /**
     * 加权轮询选择
     */
    private fun weightedRoundRobin(nodes: List<ProxyNode>): ProxyNode {
        val totalWeight = nodes.sumOf { getNodeWeight(it) }
        if (totalWeight <= 0) {
            return nodes[roundRobinCounter.getAndIncrement() % nodes.size]
        }
        
        val target = roundRobinCounter.getAndIncrement() % totalWeight
        var currentWeight = 0
        
        for (node in nodes) {
            currentWeight += getNodeWeight(node)
            if (target < currentWeight) {
                return node
            }
        }
        
        return nodes.first()
    }
    
    /**
     * 加权随机选择
     */
    private fun weightedRandomSelection(nodes: List<ProxyNode>): ProxyNode {
        val weights = nodes.map { calculateDynamicWeight(it) }
        val totalWeight = weights.sum()
        
        if (totalWeight <= 0) {
            return nodes.random()
        }
        
        val random = Random.nextDouble() * totalWeight
        var currentWeight = 0.0
        
        for (i in nodes.indices) {
            currentWeight += weights[i]
            if (random <= currentWeight) {
                return nodes[i]
            }
        }
        
        return nodes.last()
    }
    
    /**
     * 计算动态权重
     */
    private fun calculateDynamicWeight(node: ProxyNode): Double {
        val baseWeight = node.weight.toDouble()
        val successRate = node.getSuccessRate()
        val latencyFactor = if (node.latency > 0) {
            1000.0 / (node.latency + 100.0) // 延迟越低权重越高
        } else {
            1.0
        }
        
        // 综合权重 = 基础权重 × 成功率 × 延迟因子
        return baseWeight * successRate * latencyFactor
    }
    
    /**
     * 获取节点权重
     */
    private fun getNodeWeight(node: ProxyNode): Int {
        return nodeWeights.getOrDefault(node.id, node.weight).coerceAtLeast(1)
    }
    
    /**
     * 调整节点权重
     */
    fun adjustWeight(nodeId: String, success: Boolean, responseTime: Long = 0) {
        val currentWeight = nodeWeights.getOrDefault(nodeId, 100)
        
        val newWeight = if (success) {
            // 成功时增加权重
            val increment = when {
                responseTime < 200 -> 10  // 响应很快
                responseTime < 500 -> 5   // 响应较快
                responseTime < 1000 -> 2  // 响应一般
                else -> 1                 // 响应较慢
            }
            minOf(200, currentWeight + increment)
        } else {
            // 失败时降低权重
            maxOf(10, currentWeight - 15)
        }
        
        nodeWeights[nodeId] = newWeight
        Log.d(TAG, "调整节点权重: $nodeId = $newWeight (成功: $success, 响应时间: ${responseTime}ms)")
    }
    
    /**
     * 重置节点权重
     */
    fun resetWeight(nodeId: String) {
        nodeWeights.remove(nodeId)
        Log.d(TAG, "重置节点权重: $nodeId")
    }
    
    /**
     * 获取权重统计
     */
    fun getWeightStats(): Map<String, Int> {
        return nodeWeights.toMap()
    }
    
    /**
     * 清理权重缓存
     */
    fun clearWeightCache() {
        nodeWeights.clear()
        Log.d(TAG, "清理权重缓存")
    }
    
    /**
     * 选择备用节点
     * 当主节点失效时，选择最佳备用节点
     */
    fun selectBackupNode(nodes: List<ProxyNode>, excludeNodeId: String): ProxyNode? {
        val availableNodes = nodes.filter { it.id != excludeNodeId && it.isHealthy }
        return selectOptimalNode(availableNodes, SelectionStrategy.PERFORMANCE_BASED)
    }
    
    /**
     * 预热节点选择
     * 在应用启动时预先选择几个最优节点
     */
    suspend fun preWarmNodes(nodes: List<ProxyNode>, count: Int = 3): List<ProxyNode> {
        return withContext(Dispatchers.Default) {
            val candidates = nodes.filter { it.isHealthy }
                .sortedByDescending { it.getPerformanceScore() }
                .take(count * 2) // 取更多候选节点
            
            // 模拟并发测试选择最优的几个
            candidates.take(minOf(count, candidates.size))
        }
    }
}
