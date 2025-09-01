package com.vpnbrowser.core

import com.google.gson.Gson
import com.google.gson.JsonObject

/**
 * Xray配置生成器
 * 根据不同的代理协议生成对应的Xray配置文件
 */
class XrayConfigGenerator {
    private val gson = Gson()
    
    /**
     * 生成完整的Xray配置
     */
    fun generateConfig(node: ProxyNode): String {
        val config = JsonObject().apply {
            // 日志配置
            add("log", JsonObject().apply {
                addProperty("loglevel", "warning")
            })
            
            // 入站配置
            add("inbounds", gson.toJsonTree(listOf(
                createSocksInbound(),
                createHttpInbound()
            )))
            
            // 出站配置
            add("outbounds", gson.toJsonTree(listOf(
                createProxyOutbound(node),
                createDirectOutbound(),
                createBlockOutbound()
            )))
            
            // 路由配置（全局代理）
            add("routing", createGlobalProxyRouting())
        }
        
        return gson.toJson(config)
    }
    
    /**
     * 创建SOCKS入站
     */
    private fun createSocksInbound(): JsonObject {
        return JsonObject().apply {
            addProperty("tag", "socks-in")
            addProperty("port", 10808)
            addProperty("protocol", "socks")
            add("settings", JsonObject().apply {
                addProperty("udp", true)
                addProperty("auth", "noauth")
            })
            add("sniffing", JsonObject().apply {
                addProperty("enabled", true)
                add("destOverride", gson.toJsonTree(listOf("http", "tls")))
            })
        }
    }
    
    /**
     * 创建HTTP入站
     */
    private fun createHttpInbound(): JsonObject {
        return JsonObject().apply {
            addProperty("tag", "http-in")
            addProperty("port", 10809)
            addProperty("protocol", "http")
            add("settings", JsonObject())
        }
    }
    
    /**
     * 创建代理出站
     */
    private fun createProxyOutbound(node: ProxyNode): JsonObject {
        return when (node.protocol.lowercase()) {
            "vmess" -> createVmessOutbound(node)
            "vless" -> createVlessOutbound(node)
            "trojan" -> createTrojanOutbound(node)
            "socks5" -> createSocks5Outbound(node)
            "http" -> createHttpOutbound(node)
            else -> throw IllegalArgumentException("不支持的协议: ${node.protocol}")
        }
    }
    
    /**
     * 创建VMess出站
     */
    private fun createVmessOutbound(node: ProxyNode): JsonObject {
        return JsonObject().apply {
            addProperty("tag", "proxy")
            addProperty("protocol", "vmess")
            add("settings", JsonObject().apply {
                add("vnext", gson.toJsonTree(listOf(
                    JsonObject().apply {
                        addProperty("address", node.address)
                        addProperty("port", node.port)
                        add("users", gson.toJsonTree(listOf(
                            JsonObject().apply {
                                addProperty("id", node.config["uuid"])
                                addProperty("security", node.config["security"] ?: "auto")
                                addProperty("level", 0)
                            }
                        )))
                    }
                )))
            })
            
            // 传输层配置
            add("streamSettings", createStreamSettings(node))
        }
    }
    
    /**
     * 创建VLESS出站
     */
    private fun createVlessOutbound(node: ProxyNode): JsonObject {
        return JsonObject().apply {
            addProperty("tag", "proxy")
            addProperty("protocol", "vless")
            add("settings", JsonObject().apply {
                add("vnext", gson.toJsonTree(listOf(
                    JsonObject().apply {
                        addProperty("address", node.address)
                        addProperty("port", node.port)
                        add("users", gson.toJsonTree(listOf(
                            JsonObject().apply {
                                addProperty("id", node.config["uuid"])
                                addProperty("flow", node.config["flow"] ?: "")
                                addProperty("level", 0)
                            }
                        )))
                    }
                )))
            })
            
            // 传输层配置
            add("streamSettings", createStreamSettings(node))
        }
    }
    
    /**
     * 创建Trojan出站
     */
    private fun createTrojanOutbound(node: ProxyNode): JsonObject {
        return JsonObject().apply {
            addProperty("tag", "proxy")
            addProperty("protocol", "trojan")
            add("settings", JsonObject().apply {
                add("servers", gson.toJsonTree(listOf(
                    JsonObject().apply {
                        addProperty("address", node.address)
                        addProperty("port", node.port)
                        addProperty("password", node.config["password"])
                        addProperty("level", 0)
                    }
                )))
            })
            
            // 传输层配置
            add("streamSettings", createStreamSettings(node))
        }
    }
    
    /**
     * 创建SOCKS5出站
     */
    private fun createSocks5Outbound(node: ProxyNode): JsonObject {
        return JsonObject().apply {
            addProperty("tag", "proxy")
            addProperty("protocol", "socks")
            add("settings", JsonObject().apply {
                add("servers", gson.toJsonTree(listOf(
                    JsonObject().apply {
                        addProperty("address", node.address)
                        addProperty("port", node.port)
                    }
                )))
            })
        }
    }
    
    /**
     * 创建HTTP出站
     */
    private fun createHttpOutbound(node: ProxyNode): JsonObject {
        return JsonObject().apply {
            addProperty("tag", "proxy")
            addProperty("protocol", "http")
            add("settings", JsonObject().apply {
                add("servers", gson.toJsonTree(listOf(
                    JsonObject().apply {
                        addProperty("address", node.address)
                        addProperty("port", node.port)
                    }
                )))
            })
        }
    }
    
    /**
     * 创建传输层设置
     */
    private fun createStreamSettings(node: ProxyNode): JsonObject {
        val streamSettings = JsonObject()
        val network = node.config["network"] ?: "tcp"
        
        streamSettings.addProperty("network", network)
        
        // TLS配置
        val security = node.config["security"] ?: node.config["tls"]
        if (security == "tls" || security == "reality") {
            streamSettings.addProperty("security", security)
            
            if (security == "tls") {
                streamSettings.add("tlsSettings", JsonObject().apply {
                    val sni = node.config["sni"] ?: node.config["host"] ?: node.address
                    addProperty("serverName", sni)
                    addProperty("allowInsecure", false)
                    
                    node.config["alpn"]?.let { alpn ->
                        add("alpn", gson.toJsonTree(alpn.split(",")))
                    }
                })
            } else if (security == "reality") {
                streamSettings.add("realitySettings", JsonObject().apply {
                    addProperty("serverName", node.config["sni"])
                    addProperty("fingerprint", node.config["fp"] ?: "chrome")
                    addProperty("publicKey", node.config["pbk"])
                    addProperty("shortId", node.config["sid"])
                })
            }
        }
        
        // 网络层配置
        when (network) {
            "ws" -> {
                streamSettings.add("wsSettings", JsonObject().apply {
                    addProperty("path", node.config["path"] ?: "/")
                    node.config["host"]?.let { host ->
                        add("headers", JsonObject().apply {
                            addProperty("Host", host)
                        })
                    }
                })
            }
            "grpc" -> {
                streamSettings.add("grpcSettings", JsonObject().apply {
                    addProperty("serviceName", node.config["serviceName"] ?: "")
                })
            }
            "h2" -> {
                streamSettings.add("httpSettings", JsonObject().apply {
                    addProperty("path", node.config["path"] ?: "/")
                    node.config["host"]?.let { host ->
                        add("host", gson.toJsonTree(listOf(host)))
                    }
                })
            }
        }
        
        return streamSettings
    }
    
    /**
     * 创建直连出站
     */
    private fun createDirectOutbound(): JsonObject {
        return JsonObject().apply {
            addProperty("tag", "direct")
            addProperty("protocol", "freedom")
            add("settings", JsonObject())
        }
    }
    
    /**
     * 创建阻断出站
     */
    private fun createBlockOutbound(): JsonObject {
        return JsonObject().apply {
            addProperty("tag", "block")
            addProperty("protocol", "blackhole")
            add("settings", JsonObject().apply {
                add("response", JsonObject().apply {
                    addProperty("type", "http")
                })
            })
        }
    }
    
    /**
     * 创建全局代理路由
     */
    private fun createGlobalProxyRouting(): JsonObject {
        return JsonObject().apply {
            addProperty("domainStrategy", "IPIfNonMatch")
            add("rules", gson.toJsonTree(listOf(
                // 阻断广告和恶意域名
                JsonObject().apply {
                    addProperty("type", "field")
                    add("domain", gson.toJsonTree(listOf(
                        "geosite:category-ads-all"
                    )))
                    addProperty("outboundTag", "block")
                },
                
                // 所有其他流量走代理
                JsonObject().apply {
                    addProperty("type", "field")
                    add("network", gson.toJsonTree(listOf("tcp", "udp")))
                    addProperty("outboundTag", "proxy")
                }
            )))
        }
    }
    
    /**
     * 生成简化配置（用于测试）
     */
    fun generateSimpleConfig(node: ProxyNode): String {
        val config = JsonObject().apply {
            add("inbounds", gson.toJsonTree(listOf(createSocksInbound())))
            add("outbounds", gson.toJsonTree(listOf(createProxyOutbound(node))))
        }
        
        return gson.toJson(config)
    }
}
