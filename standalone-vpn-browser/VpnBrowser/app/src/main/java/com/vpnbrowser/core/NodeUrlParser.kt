package com.vpnbrowser.core

import android.net.Uri
import android.util.Base64
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

/**
 * 节点链接解析器
 * 支持解析 vmess://, vless://, trojan://, ss:// 等格式的节点链接
 */
class NodeUrlParser {
    companion object {
        private const val TAG = "NodeUrlParser"
    }
    
    private val gson = Gson()
    
    /**
     * 解析节点链接
     */
    fun parseNodeUrl(nodeUrl: String): ProxyNode? {
        return try {
            val trimmedUrl = nodeUrl.trim()
            
            when {
                trimmedUrl.startsWith("vmess://") -> parseVmessUrl(trimmedUrl)
                trimmedUrl.startsWith("vless://") -> parseVlessUrl(trimmedUrl)
                trimmedUrl.startsWith("trojan://") -> parseTrojanUrl(trimmedUrl)
                trimmedUrl.startsWith("ss://") -> parseShadowsocksUrl(trimmedUrl)
                else -> {
                    Log.w(TAG, "不支持的节点格式: $trimmedUrl")
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "解析节点链接失败: $nodeUrl", e)
            null
        }
    }
    
    /**
     * 解析 VMess 链接
     * 格式: vmess://base64(json)
     */
    private fun parseVmessUrl(url: String): ProxyNode? {
        try {
            val base64Part = url.substring(8) // 移除 "vmess://"
            val jsonStr = String(Base64.decode(base64Part, Base64.DEFAULT), StandardCharsets.UTF_8)
            val jsonObj = gson.fromJson(jsonStr, JsonObject::class.java)
            
            val address = jsonObj.get("add")?.asString ?: return null
            val port = jsonObj.get("port")?.asInt ?: 443
            val id = jsonObj.get("id")?.asString ?: return null
            val name = jsonObj.get("ps")?.asString ?: "VMess-$address"
            
            val config = hashMapOf<String, String>().apply {
                put("uuid", id)
                put("security", jsonObj.get("scy")?.asString ?: "auto")
                put("network", jsonObj.get("net")?.asString ?: "tcp")
                put("type", jsonObj.get("type")?.asString ?: "none")
                put("host", jsonObj.get("host")?.asString ?: "")
                put("path", jsonObj.get("path")?.asString ?: "/")
                put("tls", if (jsonObj.get("tls")?.asString == "tls") "true" else "false")
                put("sni", jsonObj.get("sni")?.asString ?: "")
                put("alpn", jsonObj.get("alpn")?.asString ?: "")
                put("aid", jsonObj.get("aid")?.asString ?: "0")
            }
            
            return ProxyNode(
                id = "vmess-${System.currentTimeMillis()}",
                name = name,
                protocol = "vmess",
                address = address,
                port = port,
                config = config
            )
            
        } catch (e: Exception) {
            Log.e(TAG, "解析VMess链接失败", e)
            return null
        }
    }
    
    /**
     * 解析 VLESS 链接
     * 格式: vless://uuid@address:port?params#name
     */
    private fun parseVlessUrl(url: String): ProxyNode? {
        try {
            val uri = Uri.parse(url)
            val uuid = uri.userInfo ?: return null
            val address = uri.host ?: return null
            val port = uri.port.takeIf { it != -1 } ?: 443
            val name = uri.fragment?.let { URLDecoder.decode(it, "UTF-8") } ?: "VLESS-$address"
            
            val config = hashMapOf<String, String>().apply {
                put("uuid", uuid)
                put("flow", uri.getQueryParameter("flow") ?: "")
                put("encryption", uri.getQueryParameter("encryption") ?: "none")
                put("security", uri.getQueryParameter("security") ?: "none")
                put("sni", uri.getQueryParameter("sni") ?: "")
                put("alpn", uri.getQueryParameter("alpn") ?: "")
                put("fp", uri.getQueryParameter("fp") ?: "")
                put("type", uri.getQueryParameter("type") ?: "tcp")
                put("host", uri.getQueryParameter("host") ?: "")
                put("path", uri.getQueryParameter("path") ?: "/")
                put("serviceName", uri.getQueryParameter("serviceName") ?: "")
                put("mode", uri.getQueryParameter("mode") ?: "gun")
            }
            
            return ProxyNode(
                id = "vless-${System.currentTimeMillis()}",
                name = name,
                protocol = "vless",
                address = address,
                port = port,
                config = config
            )
            
        } catch (e: Exception) {
            Log.e(TAG, "解析VLESS链接失败", e)
            return null
        }
    }
    
    /**
     * 解析 Trojan 链接
     * 格式: trojan://password@address:port?params#name
     */
    private fun parseTrojanUrl(url: String): ProxyNode? {
        try {
            val uri = Uri.parse(url)
            val password = uri.userInfo ?: return null
            val address = uri.host ?: return null
            val port = uri.port.takeIf { it != -1 } ?: 443
            val name = uri.fragment?.let { URLDecoder.decode(it, "UTF-8") } ?: "Trojan-$address"
            
            val config = hashMapOf<String, String>().apply {
                put("password", password)
                put("sni", uri.getQueryParameter("sni") ?: address)
                put("alpn", uri.getQueryParameter("alpn") ?: "")
                put("fp", uri.getQueryParameter("fp") ?: "")
                put("type", uri.getQueryParameter("type") ?: "tcp")
                put("host", uri.getQueryParameter("host") ?: "")
                put("path", uri.getQueryParameter("path") ?: "/")
                put("serviceName", uri.getQueryParameter("serviceName") ?: "")
                put("mode", uri.getQueryParameter("mode") ?: "gun")
                put("security", "tls") // Trojan 默认使用 TLS
            }
            
            return ProxyNode(
                id = "trojan-${System.currentTimeMillis()}",
                name = name,
                protocol = "trojan",
                address = address,
                port = port,
                config = config
            )
            
        } catch (e: Exception) {
            Log.e(TAG, "解析Trojan链接失败", e)
            return null
        }
    }
    
    /**
     * 解析 Shadowsocks 链接
     * 格式: ss://base64(method:password)@address:port#name
     */
    private fun parseShadowsocksUrl(url: String): ProxyNode? {
        try {
            val uri = Uri.parse(url)
            val address = uri.host ?: return null
            val port = uri.port.takeIf { it != -1 } ?: 8388
            val name = uri.fragment?.let { URLDecoder.decode(it, "UTF-8") } ?: "SS-$address"
            
            // 解析用户信息部分
            val userInfo = uri.userInfo
            val (method, password) = if (userInfo != null) {
                if (userInfo.contains(":")) {
                    // 格式: method:password
                    val parts = userInfo.split(":", limit = 2)
                    parts[0] to parts[1]
                } else {
                    // Base64 编码的 method:password
                    val decoded = String(Base64.decode(userInfo, Base64.DEFAULT), StandardCharsets.UTF_8)
                    val parts = decoded.split(":", limit = 2)
                    if (parts.size == 2) parts[0] to parts[1] else "aes-256-gcm" to decoded
                }
            } else {
                "aes-256-gcm" to ""
            }
            
            val config = hashMapOf<String, String>().apply {
                put("method", method)
                put("password", password)
                put("plugin", uri.getQueryParameter("plugin") ?: "")
                put("plugin-opts", uri.getQueryParameter("plugin-opts") ?: "")
            }
            
            return ProxyNode(
                id = "ss-${System.currentTimeMillis()}",
                name = name,
                protocol = "shadowsocks",
                address = address,
                port = port,
                config = config
            )
            
        } catch (e: Exception) {
            Log.e(TAG, "解析Shadowsocks链接失败", e)
            return null
        }
    }
    
    /**
     * 验证节点链接格式
     */
    fun isValidNodeUrl(url: String): Boolean {
        val trimmedUrl = url.trim()
        return trimmedUrl.startsWith("vmess://") ||
               trimmedUrl.startsWith("vless://") ||
               trimmedUrl.startsWith("trojan://") ||
               trimmedUrl.startsWith("ss://")
    }
    
    /**
     * 从文本中提取所有节点链接
     */
    fun extractNodeUrls(text: String): List<String> {
        val urls = mutableListOf<String>()
        val lines = text.split("\n", "\r\n", " ")
        
        for (line in lines) {
            val trimmed = line.trim()
            if (isValidNodeUrl(trimmed)) {
                urls.add(trimmed)
            }
        }
        
        return urls
    }
}
