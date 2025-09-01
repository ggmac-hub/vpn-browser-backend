package com.vpnbrowser.core

import android.content.Context
import android.content.SharedPreferences
import android.provider.Settings
import android.util.Log
import java.util.*

/**
 * 用户Token管理器
 * 负责管理用户认证token、用户信息和设备ID
 */
class UserTokenManager(private val context: Context) {
    
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    
    companion object {
        private const val TAG = "UserTokenManager"
        private const val PREFS_NAME = "user_auth"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_USER = "user_info"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_LOGIN_TIME = "login_time"
        private const val KEY_EXPIRES_AT = "expires_at"
    }
    
    /**
     * 保存认证token
     */
    fun saveToken(token: String) {
        try {
            prefs.edit().apply {
                putString(KEY_TOKEN, token)
                putLong(KEY_LOGIN_TIME, System.currentTimeMillis())
                // JWT token通常有效期7天，这里设置为7天后过期
                putLong(KEY_EXPIRES_AT, System.currentTimeMillis() + 7 * 24 * 60 * 60 * 1000)
                apply()
            }
            Log.d(TAG, "Token saved successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save token", e)
        }
    }
    
    /**
     * 获取认证token
     */
    fun getToken(): String? {
        return try {
            val token = prefs.getString(KEY_TOKEN, null)
            val expiresAt = prefs.getLong(KEY_EXPIRES_AT, 0)
            
            // 检查token是否过期
            if (token != null && System.currentTimeMillis() < expiresAt) {
                token
            } else {
                if (token != null) {
                    Log.d(TAG, "Token expired, clearing auth")
                    clearAuth()
                }
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get token", e)
            null
        }
    }
    
    /**
     * 保存用户信息
     */
    fun saveUser(userJson: String) {
        try {
            prefs.edit().putString(KEY_USER, userJson).apply()
            Log.d(TAG, "User info saved successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save user info", e)
        }
    }
    
    /**
     * 获取用户信息
     */
    fun getUser(): String? {
        return try {
            prefs.getString(KEY_USER, null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get user info", e)
            null
        }
    }
    
    /**
     * 获取设备ID
     */
    fun getDeviceId(): String {
        var deviceId = prefs.getString(KEY_DEVICE_ID, null)
        
        if (deviceId == null) {
            // 生成新的设备ID
            deviceId = generateDeviceId()
            prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
            Log.d(TAG, "Generated new device ID: $deviceId")
        }
        
        return deviceId
    }
    
    /**
     * 生成设备ID
     */
    private fun generateDeviceId(): String {
        return try {
            // 尝试使用Android ID
            val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            if (androidId != null && androidId != "9774d56d682e549c") {
                "android_$androidId"
            } else {
                // 如果Android ID不可用，生成随机ID
                "vpn_browser_${UUID.randomUUID().toString().replace("-", "").substring(0, 16)}"
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get Android ID, using random ID", e)
            "vpn_browser_${UUID.randomUUID().toString().replace("-", "").substring(0, 16)}"
        }
    }
    
    /**
     * 检查是否已登录
     */
    fun isLoggedIn(): Boolean {
        return getToken() != null
    }
    
    /**
     * 获取登录时间
     */
    fun getLoginTime(): Long {
        return prefs.getLong(KEY_LOGIN_TIME, 0)
    }
    
    /**
     * 获取token过期时间
     */
    fun getExpiresAt(): Long {
        return prefs.getLong(KEY_EXPIRES_AT, 0)
    }
    
    /**
     * 检查token是否即将过期（1天内）
     */
    fun isTokenExpiringSoon(): Boolean {
        val expiresAt = getExpiresAt()
        val oneDayInMillis = 24 * 60 * 60 * 1000
        return System.currentTimeMillis() + oneDayInMillis > expiresAt
    }
    
    /**
     * 清除所有认证信息
     */
    fun clearAuth() {
        try {
            prefs.edit().apply {
                remove(KEY_TOKEN)
                remove(KEY_USER)
                remove(KEY_LOGIN_TIME)
                remove(KEY_EXPIRES_AT)
                apply()
            }
            Log.d(TAG, "Auth cleared successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear auth", e)
        }
    }
    
    /**
     * 获取认证状态信息
     */
    fun getAuthStatus(): AuthStatus {
        val token = getToken()
        val user = getUser()
        val loginTime = getLoginTime()
        val expiresAt = getExpiresAt()
        
        return AuthStatus(
            isLoggedIn = token != null,
            hasUser = user != null,
            loginTime = loginTime,
            expiresAt = expiresAt,
            isExpiringSoon = isTokenExpiringSoon(),
            deviceId = getDeviceId()
        )
    }
    
    /**
     * 认证状态数据类
     */
    data class AuthStatus(
        val isLoggedIn: Boolean,
        val hasUser: Boolean,
        val loginTime: Long,
        val expiresAt: Long,
        val isExpiringSoon: Boolean,
        val deviceId: String
    )
}
