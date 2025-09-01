package com.vpnbrowser.core

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
import java.io.IOException
import java.net.*
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/**
 * 健康检查器
 * 负责定期检查节点健康状态，包括连通性、延迟和可用性测试
 */
class HealthChecker(private val context: Context) {
    companion object {
        private const val TAG = "HealthChecker"
    }
    
    // 协程作用域
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    // HTTP客户端
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()
    
    // 检查配置
    private val checkInterval = 30_000L // 30秒检查一次
    private val quickCheckInterval = 5_000L // 快速检查间隔
    private val testUrls = listOf(
        "https://www.google.com/generate_204", // Google连通性测试
        "https://www.youtube.com/favicon.ico", // YouTube可用性测试
        "https://httpbin.org/ip" // IP检测
    )
    
    // 检查任务
    private var healthCheckJob: Job? = null
    private var isRunning = false
    
    /**
     * 开始健康检查
     */
    fun startHealthCheck(nodePool: NodePool, loadBalancer: LoadBalancer) {
        if (isRunning) {
            Log.w(TAG, "健康检查已在运行")
            return
        }
        
        isRunning = true
        healthCheckJob = scope.launch {
            Log.i(TAG, "开始健康检查服务")
            
            while (isActive && isRunning) {
                try {
                    checkAllNodes(nodePool, loadBalancer)
                    delay(checkInterval)
                } catch (e: Exception) {
                    Log.e(TAG, "健康检查异常", e)
                    delay(quickCheckInterval) // 异常时使用快速检查间隔
                }
            }
        }
    }
    
    /**
     * 停止健康检查
     */
    fun stopHealthCheck() {
        isRunning = false
        healthCheckJob?.cancel()
        Log.i(TAG, "停止健康检查服务")
    }
    
    /**
     * 检查所有节点
     */
    private suspend fun checkAllNodes(nodePool: NodePool, loadBalancer: LoadBalancer) {
        val nodes = nodePool.getAllNodes()
        if (nodes.isEmpty()) {
            Log.w(TAG, "没有节点需要检查")
            return
        }
        
        Log.d(TAG, "开始检查${nodes.size}个节点")
        
        // 并发检查所有节点
        val checkJobs = nodes.map { node ->
            scope.async {
                val health = checkNodeHealth(node)
                updateNodeStatus(node, health, nodePool, loadBalancer)
            }
        }
        
        // 等待所有检查完成
        checkJobs.awaitAll()
        
        // 清理失效节点
        nodePool.cleanupFailedNodes()
        
        // 输出统计信息
        logHealthStats(nodePool)
    }
    
    /**
     * 检查单个节点健康状态
     */
    suspend fun checkNodeHealth(node: ProxyNode): NodeHealth {
        val startTime = System.currentTimeMillis()
        
        try {
            // 1. TCP连接测试
            val tcpResult = testTcpConnection(node)
            if (!tcpResult.success) {
                return NodeHealth(
                    isHealthy = false,
                    latency = Long.MAX_VALUE,
                    error = "TCP连接失败: ${tcpResult.error}"
                )
            }
            
            // 2. HTTP代理测试
            val httpResult = testHttpProxy(node)
            val totalLatency = System.currentTimeMillis() - startTime
            
            return NodeHealth(
                isHealthy = httpResult.success,
                latency = if (httpResult.success) totalLatency else Long.MAX_VALUE,
                error = httpResult.error
            )
            
        } catch (e: Exception) {
            return NodeHealth(
                isHealthy = false,
                latency = Long.MAX_VALUE,
                error = "检查异常: ${e.message}"
            )
        }
    }
    
    /**
     * TCP连接测试
     */
    private suspend fun testTcpConnection(node: ProxyNode): TestResult {
        return suspendCoroutine { continuation ->
            try {
                val socket = Socket()
                val startTime = System.currentTimeMillis()
                
                socket.connect(InetSocketAddress(node.address, node.port), 5000)
                val responseTime = System.currentTimeMillis() - startTime
                
                socket.close()
                continuation.resume(TestResult(true, responseTime))
                
            } catch (e: Exception) {
                continuation.resume(TestResult(false, 0, e.message))
            }
        }
    }
    
    /**
     * HTTP代理测试
     */
    private suspend fun testHttpProxy(node: ProxyNode): TestResult {
        return suspendCoroutine { continuation ->
            try {
                // 创建代理
                val proxy = when (node.protocol.lowercase()) {
                    "http" -> Proxy(Proxy.Type.HTTP, InetSocketAddress(node.address, node.port))
                    "socks", "socks5" -> Proxy(Proxy.Type.SOCKS, InetSocketAddress(node.address, node.port))
                    else -> {
                        // 对于vmess/vless/trojan，我们假设有本地SOCKS代理
                        Proxy(Proxy.Type.SOCKS, InetSocketAddress("127.0.0.1", 10808))
                    }
                }
                
                // 创建带代理的HTTP客户端
                val proxyClient = httpClient.newBuilder()
                    .proxy(proxy)
                    .build()
                
                val startTime = System.currentTimeMillis()
                
                // 测试连接
                val request = Request.Builder()
                    .url(testUrls.random())
                    .build()
                
                proxyClient.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        continuation.resume(TestResult(false, 0, e.message))
                    }
                    
                    override fun onResponse(call: Call, response: Response) {
                        val responseTime = System.currentTimeMillis() - startTime
                        response.close()
                        
                        val success = response.isSuccessful || response.code == 204
                        continuation.resume(TestResult(success, responseTime))
                    }
                })
                
            } catch (e: Exception) {
                continuation.resume(TestResult(false, 0, e.message))
            }
        }
    }
    
    /**
     * 更新节点状态
     */
    private fun updateNodeStatus(
        node: ProxyNode,
        health: NodeHealth,
        nodePool: NodePool,
        loadBalancer: LoadBalancer
    ) {
        val wasHealthy = node.isHealthy
        
        if (health.isHealthy) {
            // 节点健康
            nodePool.updateNodeLatency(node.id, health.latency)
            if (!wasHealthy) {
                nodePool.markNodeHealthy(node.id)
            }
            nodePool.recordNodeRequest(node.id, true, health.latency)
            loadBalancer.adjustWeight(node.id, true, health.latency)
            
        } else {
            // 节点不健康
            if (wasHealthy) {
                nodePool.markNodeUnhealthy(node.id, health.error)
            }
            nodePool.recordNodeRequest(node.id, false)
            loadBalancer.adjustWeight(node.id, false)
            
            Log.w(TAG, "节点${node.name}不健康: ${health.error}")
        }
    }
    
    /**
     * 快速检查节点（用于故障切换）
     */
    suspend fun quickCheckNode(node: ProxyNode): Boolean {
        return try {
            val health = checkNodeHealth(node)
            health.isHealthy
        } catch (e: Exception) {
            Log.e(TAG, "快速检查节点${node.name}失败", e)
            false
        }
    }
    
    /**
     * 批量快速检查
     */
    suspend fun quickCheckNodes(nodes: List<ProxyNode>): List<ProxyNode> {
        return withContext(Dispatchers.IO) {
            val checkJobs = nodes.map { node ->
                async {
                    val isHealthy = quickCheckNode(node)
                    if (isHealthy) node else null
                }
            }
            
            checkJobs.awaitAll().filterNotNull()
        }
    }
    
    /**
     * 测试节点到特定URL的连接
     */
    suspend fun testNodeToUrl(node: ProxyNode, url: String): TestResult {
        return suspendCoroutine { continuation ->
            try {
                val proxy = Proxy(Proxy.Type.SOCKS, InetSocketAddress("127.0.0.1", 10808))
                val proxyClient = httpClient.newBuilder()
                    .proxy(proxy)
                    .connectTimeout(5, TimeUnit.SECONDS)
                    .readTimeout(10, TimeUnit.SECONDS)
                    .build()
                
                val startTime = System.currentTimeMillis()
                val request = Request.Builder().url(url).build()
                
                proxyClient.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        continuation.resume(TestResult(false, 0, e.message))
                    }
                    
                    override fun onResponse(call: Call, response: Response) {
                        val responseTime = System.currentTimeMillis() - startTime
                        response.close()
                        continuation.resume(TestResult(response.isSuccessful, responseTime))
                    }
                })
                
            } catch (e: Exception) {
                continuation.resume(TestResult(false, 0, e.message))
            }
        }
    }
    
    /**
     * 输出健康统计信息
     */
    private fun logHealthStats(nodePool: NodePool) {
        val stats = nodePool.getNodeStats()
        Log.i(TAG, "健康检查统计: " +
                "总节点=${stats["totalNodes"]}, " +
                "健康节点=${stats["healthyNodes"]}, " +
                "平均延迟=${stats["avgLatency"]}ms, " +
                "最佳延迟=${stats["bestLatency"]}ms")
    }
    
    /**
     * 销毁资源
     */
    fun destroy() {
        stopHealthCheck()
        scope.cancel()
        httpClient.dispatcher.executorService.shutdown()
    }
}
