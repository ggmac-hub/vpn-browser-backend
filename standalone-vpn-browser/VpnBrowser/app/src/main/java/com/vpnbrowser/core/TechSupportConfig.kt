package com.vpnbrowser.core

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName

/**
 * 技术支持配置
 * 支持从后端动态更新联系方式
 */
data class TechSupportInfo(
    @SerializedName("qq")
    val qq: String = "",
    
    @SerializedName("wechat")
    val wechat: String = "",
    
    @SerializedName("telegram")
    val telegram: String = "",
    
    @SerializedName("email")
    val email: String = "",
    
    @SerializedName("website")
    val website: String = "",
    
    @SerializedName("support_hours")
    val supportHours: String = "工作日 9:00-18:00",
    
    @SerializedName("last_updated")
    val lastUpdated: Long = System.currentTimeMillis()
)

/**
 * 技术支持配置管理器
 */
class TechSupportConfig(private val context: Context) {
    companion object {
        private const val TAG = "TechSupportConfig"
        private const val PREFS_NAME = "tech_support_config"
        private const val KEY_SUPPORT_INFO = "support_info"
        private const val KEY_LAST_FETCH = "last_fetch"
        private const val CACHE_DURATION = 24 * 60 * 60 * 1000L // 24小时缓存
    }
    
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()
    
    /**
     * 获取技术支持信息
     */
    fun getTechSupportInfo(): TechSupportInfo {
        return try {
            val json = prefs.getString(KEY_SUPPORT_INFO, null)
            if (json != null) {
                gson.fromJson(json, TechSupportInfo::class.java)
            } else {
                getDefaultSupportInfo()
            }
        } catch (e: Exception) {
            Log.e(TAG, "获取技术支持信息失败", e)
            getDefaultSupportInfo()
        }
    }
    
    /**
     * 保存技术支持信息
     */
    fun saveTechSupportInfo(supportInfo: TechSupportInfo) {
        try {
            val json = gson.toJson(supportInfo)
            prefs.edit()
                .putString(KEY_SUPPORT_INFO, json)
                .putLong(KEY_LAST_FETCH, System.currentTimeMillis())
                .apply()
            Log.i(TAG, "技术支持信息已保存")
        } catch (e: Exception) {
            Log.e(TAG, "保存技术支持信息失败", e)
        }
    }
    
    /**
     * 检查是否需要更新
     */
    fun shouldUpdate(): Boolean {
        val lastFetch = prefs.getLong(KEY_LAST_FETCH, 0)
        return System.currentTimeMillis() - lastFetch > CACHE_DURATION
    }
    
    /**
     * 获取默认技术支持信息
     */
    private fun getDefaultSupportInfo(): TechSupportInfo {
        return TechSupportInfo(
            qq = "888888888",
            wechat = "vpn_support_2024",
            telegram = "", // 不显示
            email = "", // 不显示
            website = "", // 不显示
            supportHours = "工作日 9:00-18:00 (北京时间)",
            lastUpdated = System.currentTimeMillis()
        )
    }
    
    /**
     * 从后端API更新技术支持信息
     */
    suspend fun updateFromServer(apiService: com.vpnbrowser.api.ApiService): Boolean {
        return try {
            Log.i(TAG, "开始从服务器更新技术支持信息")
            
            val result = apiService.getTechSupportInfo()
            
            when (result) {
                is com.vpnbrowser.api.ApiResult.Success -> {
                    saveTechSupportInfo(result.data)
                    Log.i(TAG, "技术支持信息更新成功")
                    true
                }
                is com.vpnbrowser.api.ApiResult.Error -> {
                    Log.w(TAG, "从服务器获取技术支持信息失败: ${result.message}")
                    false
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "从服务器更新技术支持信息异常", e)
            false
        }
    }
    
    /**
     * 自动更新技术支持信息（如果需要）
     */
    suspend fun autoUpdateIfNeeded(apiService: com.vpnbrowser.api.ApiService): Boolean {
        return if (shouldUpdate()) {
            Log.i(TAG, "检测到需要更新技术支持信息")
            updateFromServer(apiService)
        } else {
            Log.d(TAG, "技术支持信息仍在缓存期内，无需更新")
            true
        }
    }
    
    /**
     * 清除缓存
     */
    fun clearCache() {
        prefs.edit()
            .remove(KEY_SUPPORT_INFO)
            .remove(KEY_LAST_FETCH)
            .apply()
        Log.i(TAG, "技术支持信息缓存已清除")
    }
}
