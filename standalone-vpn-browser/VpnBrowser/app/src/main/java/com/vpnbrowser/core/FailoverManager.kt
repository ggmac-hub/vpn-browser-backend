package com.vpnbrowser.core

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/**
 * 故障切换管理器
 * 负责监控当前节点状态，在故障时自动切换到最优备用节点
 */
class FailoverManager(
    private val context: Context,
    private val nodePool: NodePool,
    private val loadBalancer: LoadBalancer,
    private val healthChecker: HealthChecker
) {
    companion object {
        private const val TAG = "FailoverManager"
    }
    
    // 当前使用的节点
    private val currentNode = AtomicReference<ProxyNode?>(null)
    
    // 故障切换状态
    private val isSwitching = AtomicBoolean(false)
    
    // 协程作用域
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    // 配置参数
    private val failureThreshold = 3 // 连续失败次数阈值
    private val switchCooldown = 5000L // 切换冷却时间5秒
    private val quickSwitchThreshold = 10000L // 快速切换阈值10秒
    private val maxSwitchAttempts = 3 // 最大切换尝试次数
    
    // 状态记录
    private var lastSwitchTime = 0L
    private var switchAttempts = 0
    private var consecutiveFailures = 0
    
    // 回调接口
    interface FailoverCallback {
        fun onNodeChanged(oldNode: ProxyNode?, newNode: ProxyNode?)
        fun onSwitchStarted(reason: String)
        fun onSwitchCompleted(success: Boolean, newNode: ProxyNode?)
        fun onSwitchFailed(reason: String)
    }
    
    private var callback: FailoverCallback? = null
    
    /**
     * 设置回调
     */
    fun setCallback(callback: FailoverCallback) {
        this.callback = callback
    }
    
    /**
     * 获取当前节点
     */
    fun getCurrentNode(): ProxyNode? = currentNode.get()
    
    /**
     * 设置当前节点
     */
    fun setCurrentNode(node: ProxyNode?) {
        val oldNode = currentNode.getAndSet(node)
        if (oldNode?.id != node?.id) {
            Log.i(TAG, "当前节点变更: ${oldNode?.name} -> ${node?.name}")
            callback?.onNodeChanged(oldNode, node)
        }
    }
    
    /**
     * 处理请求失败
     */
    fun handleRequestFailure(node: ProxyNode, error: String? = null) {
        if (node.id != currentNode.get()?.id) {
            return // 不是当前节点的失败，忽略
        }
        
        consecutiveFailures++
        node.failureCount++
        
        Log.w(TAG, "节点${node.name}请求失败 (连续失败: $consecutiveFailures, 总失败: ${node.failureCount}): $error")
        
        // 记录失败
        nodePool.recordNodeRequest(node.id, false)
        loadBalancer.adjustWeight(node.id, false)
        
        // 判断是否需要切换
        val shouldSwitch = shouldTriggerFailover(node)
        if (shouldSwitch) {
            scope.launch {
                performFailover("连续失败${consecutiveFailures}次")
            }
        }
    }
    
    /**
     * 处理请求成功
     */
    fun handleRequestSuccess(node: ProxyNode, responseTime: Long = 0) {
        if (node.id != currentNode.get()?.id) {
            return
        }
        
        // 重置失败计数
        consecutiveFailures = 0
        switchAttempts = 0
        node.failureCount = 0
        
        // 记录成功
        nodePool.recordNodeRequest(node.id, true, responseTime)
        loadBalancer.adjustWeight(node.id, true, responseTime)
    }
    
    /**
     * 判断是否应该触发故障切换
     */
    private fun shouldTriggerFailover(node: ProxyNode): Boolean {
        val currentTime = System.currentTimeMillis()
        
        // 检查冷却时间
        if (currentTime - lastSwitchTime < switchCooldown) {
            Log.d(TAG, "在切换冷却期内，跳过切换")
            return false
        }
        
        // 检查是否正在切换
        if (isSwitching.get()) {
            Log.d(TAG, "正在切换中，跳过")
            return false
        }
        
        // 检查切换次数限制
        if (switchAttempts >= maxSwitchAttempts) {
            Log.w(TAG, "达到最大切换次数限制")
            return false
        }
        
        // 检查失败阈值
        return consecutiveFailures >= failureThreshold || node.failureCount >= failureThreshold
    }
    
    /**
     * 执行故障切换
     */
    private suspend fun performFailover(reason: String) {
        if (!isSwitching.compareAndSet(false, true)) {
            Log.w(TAG, "已在切换中，跳过")
            return
        }
        
        try {
            Log.i(TAG, "开始故障切换: $reason")
            callback?.onSwitchStarted(reason)
            
            val oldNode = currentNode.get()
            switchAttempts++
            lastSwitchTime = System.currentTimeMillis()
            
            // 标记当前节点为不健康
            oldNode?.let { node ->
                nodePool.markNodeUnhealthy(node.id, reason)
            }
            
            // 选择新节点
            val newNode = selectBestAlternativeNode(oldNode)
            
            if (newNode == null) {
                Log.e(TAG, "没有可用的备用节点")
                callback?.onSwitchFailed("没有可用节点")
                
                // 尝试恢复原节点
                oldNode?.let { attemptNodeRecovery(it) }
                return
            }
            
            // 验证新节点
            val isNewNodeHealthy = healthChecker.quickCheckNode(newNode)
            if (!isNewNodeHealthy) {
                Log.w(TAG, "选中的新节点${newNode.name}不健康，继续寻找")
                nodePool.markNodeUnhealthy(newNode.id, "快速检查失败")
                
                // 递归尝试下一个节点
                delay(1000)
                performFailover("备用节点不健康")
                return
            }
            
            // 切换到新节点
            switchToNode(newNode)
            
            Log.i(TAG, "故障切换成功: ${oldNode?.name} -> ${newNode.name}")
            callback?.onSwitchCompleted(true, newNode)
            
            // 重置计数器
            consecutiveFailures = 0
            
        } catch (e: Exception) {
            Log.e(TAG, "故障切换异常", e)
            callback?.onSwitchFailed("切换异常: ${e.message}")
        } finally {
            isSwitching.set(false)
        }
    }
    
    /**
     * 选择最佳备用节点
     */
    private suspend fun selectBestAlternativeNode(excludeNode: ProxyNode?): ProxyNode? {
        val healthyNodes = nodePool.getHealthyNodes()
        val availableNodes = if (excludeNode != null) {
            healthyNodes.filter { it.id != excludeNode.id }
        } else {
            healthyNodes
        }
        
        if (availableNodes.isEmpty()) {
            Log.w(TAG, "没有健康的备用节点")
            
            // 尝试快速检查所有节点
            val allNodes = nodePool.getAllNodes().filter { it.id != excludeNode?.id }
            val quickCheckedNodes = healthChecker.quickCheckNodes(allNodes)
            
            return if (quickCheckedNodes.isNotEmpty()) {
                loadBalancer.selectOptimalNode(quickCheckedNodes)
            } else {
                null
            }
        }
        
        // 使用负载均衡器选择最优节点
        return loadBalancer.selectOptimalNode(availableNodes)
    }
    
    /**
     * 切换到指定节点
     */
    private suspend fun switchToNode(node: ProxyNode) {
        // 这里应该调用Xray配置更新
        // 由于我们还没有实现XrayManager，先记录日志
        Log.i(TAG, "切换到节点: ${node.name} (${node.address}:${node.port})")
        
        // 更新当前节点
        setCurrentNode(node)
        
        // TODO: 实际的Xray配置更新
        // XrayManager.updateConfig(generateConfigForNode(node))
    }
    
    /**
     * 尝试恢复节点
     */
    private suspend fun attemptNodeRecovery(node: ProxyNode) {
        Log.i(TAG, "尝试恢复节点: ${node.name}")
        
        try {
            val isHealthy = healthChecker.quickCheckNode(node)
            if (isHealthy) {
                nodePool.markNodeHealthy(node.id)
                Log.i(TAG, "节点${node.name}已恢复")
            }
        } catch (e: Exception) {
            Log.e(TAG, "节点恢复检查失败", e)
        }
    }
    
    /**
     * 主动切换到最优节点
     */
    suspend fun switchToOptimalNode(): Boolean {
        if (isSwitching.get()) {
            Log.w(TAG, "正在切换中，无法执行主动切换")
            return false
        }
        
        val currentNode = getCurrentNode()
        val optimalNode = nodePool.getOptimalNode()
        
        if (optimalNode == null) {
            Log.w(TAG, "没有可用的最优节点")
            return false
        }
        
        if (currentNode?.id == optimalNode.id) {
            Log.d(TAG, "当前节点已是最优节点")
            return true
        }
        
        // 比较性能，只有明显更优才切换
        if (currentNode != null && !isSignificantlyBetter(optimalNode, currentNode)) {
            Log.d(TAG, "最优节点性能提升不明显，保持当前节点")
            return true
        }
        
        return try {
            isSwitching.set(true)
            switchToNode(optimalNode)
            Log.i(TAG, "主动切换到最优节点: ${optimalNode.name}")
            true
        } catch (e: Exception) {
            Log.e(TAG, "主动切换失败", e)
            false
        } finally {
            isSwitching.set(false)
        }
    }
    
    /**
     * 判断节点是否明显更优
     */
    private fun isSignificantlyBetter(newNode: ProxyNode, currentNode: ProxyNode): Boolean {
        val newScore = newNode.getPerformanceScore()
        val currentScore = currentNode.getPerformanceScore()
        
        // 新节点性能至少要好20%才值得切换
        return newScore > currentScore * 1.2
    }
    
    /**
     * 获取故障切换统计
     */
    fun getFailoverStats(): Map<String, Any> {
        return hashMapOf<String, Any>(
            "currentNode" to (currentNode.get()?.name ?: "无"),
            "consecutiveFailures" to consecutiveFailures,
            "switchAttempts" to switchAttempts,
            "lastSwitchTime" to lastSwitchTime,
            "isSwitching" to isSwitching.get()
        )
    }
    
    /**
     * 重置故障切换状态
     */
    fun resetFailoverState() {
        consecutiveFailures = 0
        switchAttempts = 0
        isSwitching.set(false)
        Log.i(TAG, "重置故障切换状态")
    }
    
    /**
     * 销毁资源
     */
    fun destroy() {
        scope.cancel()
        callback = null
    }
}
