package com.vpnbrowser.service

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.URL
import java.net.URLConnection

/**
 * 简化的代理管理器
 * 提供基础的HTTP/SOCKS代理功能
 */
object SimpleProxyManager {
    
    private const val TAG = "SimpleProxyManager"
    
    // 代理配置
    data class ProxyConfig(
        val type: ProxyType,
        val host: String,
        val port: Int,
        val username: String? = null,
        val password: String? = null
    )
    
    enum class ProxyType {
        HTTP, SOCKS, DIRECT
    }
    
    private var currentProxy: ProxyConfig? = null
    private var isProxyEnabled = false
    
    /**
     * 设置代理配置
     */
    fun setProxyConfig(config: ProxyConfig) {
        currentProxy = config
        Log.d(TAG, "代理配置已设置: ${config.type} ${config.host}:${config.port}")
    }
    
    /**
     * 启用代理
     */
    fun enableProxy() {
        isProxyEnabled = true
        Log.d(TAG, "代理已启用")
    }
    
    /**
     * 禁用代理
     */
    fun disableProxy() {
        isProxyEnabled = false
        Log.d(TAG, "代理已禁用")
    }
    
    /**
     * 检查代理状态
     */
    fun isProxyEnabled(): Boolean = isProxyEnabled
    
    /**
     * 获取当前代理配置
     */
    fun getCurrentProxy(): ProxyConfig? = currentProxy
    
    /**
     * 创建代理连接
     */
    fun createProxyConnection(url: String): URLConnection? {
        return try {
            val targetUrl = URL(url)
            
            if (!isProxyEnabled || currentProxy == null) {
                // 直连
                return targetUrl.openConnection()
            }
            
            val proxy = when (currentProxy!!.type) {
                ProxyType.HTTP -> {
                    Proxy(Proxy.Type.HTTP, InetSocketAddress(currentProxy!!.host, currentProxy!!.port))
                }
                ProxyType.SOCKS -> {
                    Proxy(Proxy.Type.SOCKS, InetSocketAddress(currentProxy!!.host, currentProxy!!.port))
                }
                ProxyType.DIRECT -> {
                    Proxy.NO_PROXY
                }
            }
            
            targetUrl.openConnection(proxy)
            
        } catch (e: Exception) {
            Log.e(TAG, "创建代理连接失败", e)
            null
        }
    }
    
    /**
     * 测试代理连接
     */
    suspend fun testProxyConnection(config: ProxyConfig): Boolean = withContext(Dispatchers.IO) {
        return@withContext try {
            val testUrl = "https://www.google.com"
            val url = URL(testUrl)
            
            val proxy = when (config.type) {
                ProxyType.HTTP -> {
                    Proxy(Proxy.Type.HTTP, InetSocketAddress(config.host, config.port))
                }
                ProxyType.SOCKS -> {
                    Proxy(Proxy.Type.SOCKS, InetSocketAddress(config.host, config.port))
                }
                ProxyType.DIRECT -> {
                    Proxy.NO_PROXY
                }
            }
            
            val connection = url.openConnection(proxy)
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            connection.connect()
            
            Log.d(TAG, "代理连接测试成功")
            true
            
        } catch (e: Exception) {
            Log.e(TAG, "代理连接测试失败", e)
            false
        }
    }
    
    /**
     * 保存代理配置到本地
     */
    fun saveProxyConfig(context: Context, config: ProxyConfig) {
        val prefs = context.getSharedPreferences("proxy_config", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("proxy_type", config.type.name)
            putString("proxy_host", config.host)
            putInt("proxy_port", config.port)
            putString("proxy_username", config.username)
            putString("proxy_password", config.password)
            apply()
        }
        Log.d(TAG, "代理配置已保存")
    }
    
    /**
     * 从本地加载代理配置
     */
    fun loadProxyConfig(context: Context): ProxyConfig? {
        val prefs = context.getSharedPreferences("proxy_config", Context.MODE_PRIVATE)
        val type = prefs.getString("proxy_type", null) ?: return null
        val host = prefs.getString("proxy_host", "") ?: ""
        val port = prefs.getInt("proxy_port", 0)
        val username = prefs.getString("proxy_username", null)
        val password = prefs.getString("proxy_password", null)
        
        return try {
            ProxyConfig(
                type = ProxyType.valueOf(type),
                host = host,
                port = port,
                username = username,
                password = password
            )
        } catch (e: Exception) {
            Log.e(TAG, "加载代理配置失败", e)
            null
        }
    }
}
