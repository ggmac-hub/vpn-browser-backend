package com.vpnbrowser.api

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.vpnbrowser.core.ProxyNode
import com.vpnbrowser.core.TechSupportInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.util.concurrent.TimeUnit

/**
 * API服务类
 * 负责与后端服务器通信，获取配置信息和节点数据
 */
class ApiService(private val context: Context) {
    companion object {
        private const val TAG = "ApiService"
        
        // API端点配置
        private const val BASE_URL = "https://api.vpnbrowser.com"
        private const val TECH_SUPPORT_ENDPOINT = "$BASE_URL/support"
        private const val NODES_ENDPOINT = "$BASE_URL/nodes"
        private const val CONFIG_ENDPOINT = "$BASE_URL/config"
        
        // 请求超时配置
        private const val CONNECT_TIMEOUT = 10L
        private const val READ_TIMEOUT = 30L
        private const val WRITE_TIMEOUT = 30L
    }
    
    private val gson = Gson()
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(CONNECT_TIMEOUT, TimeUnit.SECONDS)
        .readTimeout(READ_TIMEOUT, TimeUnit.SECONDS)
        .writeTimeout(WRITE_TIMEOUT, TimeUnit.SECONDS)
        .build()
    
    /**
     * 检查网络连接状态
     */
    fun isNetworkAvailable(): Boolean {
        return try {
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = connectivityManager.activeNetwork ?: return false
            val networkCapabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            
            networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
            networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        } catch (e: Exception) {
            Log.e(TAG, "检查网络状态失败", e)
            false
        }
    }
    
    /**
     * 获取技术支持信息
     */
    suspend fun getTechSupportInfo(): ApiResult<TechSupportInfo> {
        return withContext(Dispatchers.IO) {
            try {
                if (!isNetworkAvailable()) {
                    return@withContext ApiResult.Error("网络连接不可用")
                }
                
                val request = Request.Builder()
                    .url(TECH_SUPPORT_ENDPOINT)
                    .addHeader("User-Agent", "VpnBrowser/1.0")
                    .addHeader("Accept", "application/json")
                    .build()
                
                val response = httpClient.newCall(request).execute()
                
                if (response.isSuccessful) {
                    val responseBody = response.body?.string()
                    if (responseBody != null) {
                        val supportInfo = gson.fromJson(responseBody, TechSupportInfo::class.java)
                        Log.i(TAG, "技术支持信息获取成功")
                        ApiResult.Success(supportInfo)
                    } else {
                        ApiResult.Error("响应内容为空")
                    }
                } else {
                    ApiResult.Error("服务器错误: ${response.code}")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "获取技术支持信息失败", e)
                ApiResult.Error("网络请求失败: ${e.message}")
            }
        }
    }
    
    /**
     * 获取节点配置列表
     */
    suspend fun getNodeConfigs(): ApiResult<List<ProxyNode>> {
        return withContext(Dispatchers.IO) {
            try {
                if (!isNetworkAvailable()) {
                    return@withContext ApiResult.Error("网络连接不可用")
                }
                
                val request = Request.Builder()
                    .url(NODES_ENDPOINT)
                    .addHeader("User-Agent", "VpnBrowser/1.0")
                    .addHeader("Accept", "application/json")
                    .build()
                
                val response = httpClient.newCall(request).execute()
                
                if (response.isSuccessful) {
                    val responseBody = response.body?.string()
                    if (responseBody != null) {
                        val type = object : TypeToken<List<ProxyNode>>() {}.type
                        val nodes: List<ProxyNode> = gson.fromJson(responseBody, type)
                        Log.i(TAG, "节点配置获取成功，共${nodes.size}个节点")
                        ApiResult.Success(nodes)
                    } else {
                        ApiResult.Error("响应内容为空")
                    }
                } else {
                    ApiResult.Error("服务器错误: ${response.code}")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "获取节点配置失败", e)
                ApiResult.Error("网络请求失败: ${e.message}")
            }
        }
    }
    
    /**
     * 获取应用配置信息
     */
    suspend fun getAppConfig(): ApiResult<AppConfig> {
        return withContext(Dispatchers.IO) {
            try {
                if (!isNetworkAvailable()) {
                    return@withContext ApiResult.Error("网络连接不可用")
                }
                
                val request = Request.Builder()
                    .url(CONFIG_ENDPOINT)
                    .addHeader("User-Agent", "VpnBrowser/1.0")
                    .addHeader("Accept", "application/json")
                    .build()
                
                val response = httpClient.newCall(request).execute()
                
                if (response.isSuccessful) {
                    val responseBody = response.body?.string()
                    if (responseBody != null) {
                        val config = gson.fromJson(responseBody, AppConfig::class.java)
                        Log.i(TAG, "应用配置获取成功")
                        ApiResult.Success(config)
                    } else {
                        ApiResult.Error("响应内容为空")
                    }
                } else {
                    ApiResult.Error("服务器错误: ${response.code}")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "获取应用配置失败", e)
                ApiResult.Error("网络请求失败: ${e.message}")
            }
        }
    }
    
    /**
     * 测试API连接
     */
    suspend fun testConnection(): ApiResult<String> {
        return withContext(Dispatchers.IO) {
            try {
                if (!isNetworkAvailable()) {
                    return@withContext ApiResult.Error("网络连接不可用")
                }
                
                val request = Request.Builder()
                    .url("$BASE_URL/ping")
                    .addHeader("User-Agent", "VpnBrowser/1.0")
                    .build()
                
                val response = httpClient.newCall(request).execute()
                
                if (response.isSuccessful) {
                    ApiResult.Success("连接正常")
                } else {
                    ApiResult.Error("服务器响应异常: ${response.code}")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "测试连接失败", e)
                ApiResult.Error("连接测试失败: ${e.message}")
            }
        }
    }
}

/**
 * API请求结果封装
 */
sealed class ApiResult<T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error<T>(val message: String) : ApiResult<T>()
    
    fun isSuccess(): Boolean = this is Success
    fun isError(): Boolean = this is Error
    
    fun getDataOrNull(): T? = if (this is Success) data else null
    fun getErrorMessage(): String = if (this is Error) message else ""
}

/**
 * 应用配置数据类
 */
data class AppConfig(
    val version: String = "1.0.0",
    val updateUrl: String = "",
    val announcement: String = "",
    val maintenanceMode: Boolean = false,
    val features: Map<String, Boolean> = emptyMap(),
    val lastUpdated: Long = System.currentTimeMillis()
)
