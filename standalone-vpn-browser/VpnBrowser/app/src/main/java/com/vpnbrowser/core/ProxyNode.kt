package com.vpnbrowser.core

import kotlinx.serialization.Serializable

/**
 * 代理节点数据类
 */
@Serializable
data class ProxyNode(
    val id: String,
    val name: String,
    val protocol: String, // vmess, vless, trojan
    val address: String,
    val port: Int,
    val config: HashMap<String, String>, // 协议特定配置
    var latency: Long = Long.MAX_VALUE,
    var isHealthy: Boolean = true,
    var failureCount: Int = 0,
    var lastChecked: Long = 0,
    var weight: Int = 100, // 权重，用于负载均衡
    var successCount: Int = 0,
    var totalRequests: Int = 0
) {
    /**
     * 获取成功率
     */
    fun getSuccessRate(): Double {
        return if (totalRequests > 0) {
            successCount.toDouble() / totalRequests.toDouble()
        } else {
            1.0
        }
    }
    
    /**
     * 获取性能评分
     */
    fun getPerformanceScore(): Double {
        val successRate = getSuccessRate()
        val latencyScore = if (latency == Long.MAX_VALUE) 0.0 else 1000.0 / latency
        return successRate * 0.7 + latencyScore * 0.3
    }
    
    /**
     * 记录请求结果
     */
    fun recordRequest(success: Boolean, responseTime: Long = 0) {
        totalRequests++
        if (success) {
            successCount++
            failureCount = 0
            if (responseTime > 0) {
                // 使用移动平均更新延迟
                latency = if (latency == Long.MAX_VALUE) {
                    responseTime
                } else {
                    (latency * 0.7 + responseTime * 0.3).toLong()
                }
            }
        } else {
            failureCount++
        }
        lastChecked = System.currentTimeMillis()
    }
}

/**
 * 节点健康状态
 */
data class NodeHealth(
    val isHealthy: Boolean,
    val latency: Long,
    val error: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * 测试结果
 */
data class TestResult(
    val success: Boolean,
    val responseTime: Long = 0,
    val error: String? = null
)
