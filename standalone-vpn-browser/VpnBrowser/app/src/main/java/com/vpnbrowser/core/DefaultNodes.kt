package com.vpnbrowser.core

/**
 * 默认内置节点配置
 * 提供多个预配置的代理节点，支持VMess、VLESS、Trojan协议
 */
object DefaultNodes {
    
    /**
     * 获取内置节点列表
     */
    fun getBuiltinNodes(): List<ProxyNode> = listOf(
        // 美国节点 - VMess
        ProxyNode(
            id = "us-vmess-01",
            name = "美国-洛杉矶-01",
            protocol = "vmess",
            address = "us1.example.com",
            port = 443,
            config = hashMapOf(
                "uuid" to "12345678-1234-1234-1234-123456789abc",
                "security" to "auto",
                "network" to "ws",
                "path" to "/vmess",
                "host" to "us1.example.com",
                "tls" to "tls"
            ),
            weight = 100
        ),
        
        ProxyNode(
            id = "us-vmess-02",
            name = "美国-纽约-02", 
            protocol = "vmess",
            address = "us2.example.com",
            port = 443,
            config = hashMapOf(
                "uuid" to "87654321-4321-4321-4321-cba987654321",
                "security" to "auto",
                "network" to "ws",
                "path" to "/ray",
                "host" to "us2.example.com",
                "tls" to "tls"
            ),
            weight = 95
        ),
        
        // 日本节点 - VLESS
        ProxyNode(
            id = "jp-vless-01",
            name = "日本-东京-01",
            protocol = "vless",
            address = "jp1.example.com",
            port = 443,
            config = hashMapOf(
                "uuid" to "abcdef12-3456-7890-abcd-ef1234567890",
                "flow" to "xtls-rprx-vision",
                "network" to "tcp",
                "security" to "reality",
                "sni" to "www.microsoft.com",
                "fp" to "chrome",
                "pbk" to "example-public-key",
                "sid" to "example-short-id"
            ),
            weight = 90
        ),
        
        ProxyNode(
            id = "jp-vless-02",
            name = "日本-大阪-02",
            protocol = "vless",
            address = "jp2.example.com",
            port = 443,
            config = hashMapOf(
                "uuid" to "fedcba09-8765-4321-fedc-ba0987654321",
                "flow" to "",
                "network" to "ws",
                "path" to "/vless",
                "host" to "jp2.example.com",
                "tls" to "tls"
            ),
            weight = 85
        ),
        
        // 新加坡节点 - Trojan
        ProxyNode(
            id = "sg-trojan-01",
            name = "新加坡-01",
            protocol = "trojan",
            address = "sg1.example.com",
            port = 443,
            config = hashMapOf(
                "password" to "example-trojan-password-123",
                "sni" to "sg1.example.com",
                "network" to "tcp",
                "security" to "tls",
                "alpn" to "h2,http/1.1"
            ),
            weight = 88
        ),
        
        // 香港节点 - VMess
        ProxyNode(
            id = "hk-vmess-01",
            name = "香港-01",
            protocol = "vmess",
            address = "hk1.example.com",
            port = 443,
            config = hashMapOf(
                "uuid" to "11111111-2222-3333-4444-555555555555",
                "security" to "auto",
                "network" to "ws",
                "path" to "/hk",
                "host" to "hk1.example.com",
                "tls" to "tls"
            ),
            weight = 92
        ),
        
        // 英国节点 - VLESS
        ProxyNode(
            id = "uk-vless-01",
            name = "英国-伦敦-01",
            protocol = "vless",
            address = "uk1.example.com",
            port = 443,
            config = hashMapOf(
                "uuid" to "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                "flow" to "",
                "network" to "ws",
                "path" to "/uk-vless",
                "host" to "uk1.example.com",
                "tls" to "tls"
            ),
            weight = 80
        ),
        
        // 德国节点 - Trojan
        ProxyNode(
            id = "de-trojan-01",
            name = "德国-法兰克福-01",
            protocol = "trojan",
            address = "de1.example.com",
            port = 443,
            config = hashMapOf(
                "password" to "german-trojan-password-456",
                "sni" to "de1.example.com",
                "network" to "tcp",
                "security" to "tls"
            ),
            weight = 75
        ),
        
        // 加拿大节点 - VMess
        ProxyNode(
            id = "ca-vmess-01",
            name = "加拿大-多伦多-01",
            protocol = "vmess",
            address = "ca1.example.com",
            port = 443,
            config = hashMapOf(
                "uuid" to "99999999-8888-7777-6666-555555555555",
                "security" to "auto",
                "network" to "ws",
                "path" to "/canada",
                "host" to "ca1.example.com",
                "tls" to "tls"
            ),
            weight = 78
        ),
        
        // 韩国节点 - VLESS
        ProxyNode(
            id = "kr-vless-01",
            name = "韩国-首尔-01",
            protocol = "vless",
            address = "kr1.example.com",
            port = 443,
            config = hashMapOf(
                "uuid" to "12121212-3434-5656-7878-909090909090",
                "flow" to "",
                "network" to "ws",
                "path" to "/korea",
                "host" to "kr1.example.com",
                "tls" to "tls"
            ),
            weight = 82
        ),
        
        // 澳大利亚节点 - Trojan
        ProxyNode(
            id = "au-trojan-01",
            name = "澳大利亚-悉尼-01",
            protocol = "trojan",
            address = "au1.example.com",
            port = 443,
            config = hashMapOf(
                "password" to "australia-trojan-password-789",
                "sni" to "au1.example.com",
                "network" to "tcp",
                "security" to "tls"
            ),
            weight = 70
        )
    )
    
    /**
     * 获取测试节点（用于开发测试）
     */
    fun getTestNodes(): List<ProxyNode> = listOf(
        ProxyNode(
            id = "test-local",
            name = "本地测试",
            protocol = "socks5",
            address = "127.0.0.1",
            port = 1080,
            config = hashMapOf(),
            weight = 100
        ),
        
        ProxyNode(
            id = "test-http",
            name = "HTTP代理测试",
            protocol = "http",
            address = "127.0.0.1",
            port = 8080,
            config = hashMapOf(),
            weight = 90
        )
    )
    
    /**
     * 根据地区获取节点
     */
    fun getNodesByRegion(region: String): List<ProxyNode> {
        return getBuiltinNodes().filter { node ->
            when (region.lowercase()) {
                "us", "usa", "america" -> node.id.startsWith("us-")
                "jp", "japan" -> node.id.startsWith("jp-")
                "sg", "singapore" -> node.id.startsWith("sg-")
                "hk", "hongkong" -> node.id.startsWith("hk-")
                "uk", "britain" -> node.id.startsWith("uk-")
                "de", "germany" -> node.id.startsWith("de-")
                "ca", "canada" -> node.id.startsWith("ca-")
                "kr", "korea" -> node.id.startsWith("kr-")
                "au", "australia" -> node.id.startsWith("au-")
                else -> false
            }
        }
    }
    
    /**
     * 根据协议获取节点
     */
    fun getNodesByProtocol(protocol: String): List<ProxyNode> {
        return getBuiltinNodes().filter { it.protocol.equals(protocol, ignoreCase = true) }
    }
    
    /**
     * 获取推荐节点（高权重节点）
     */
    fun getRecommendedNodes(): List<ProxyNode> {
        return getBuiltinNodes().filter { it.weight >= 85 }.sortedByDescending { it.weight }
    }
    
    /**
     * 获取快速节点（预期延迟较低的节点）
     */
    fun getFastNodes(): List<ProxyNode> {
        // 基于地理位置和经验，亚洲节点通常对中国用户延迟较低
        val asianNodes = getNodesByRegion("jp") + getNodesByRegion("sg") + getNodesByRegion("hk") + getNodesByRegion("kr")
        val usNodes = getNodesByRegion("us").take(2) // 美国西海岸节点也不错
        
        return (asianNodes + usNodes).sortedByDescending { it.weight }
    }
    
    /**
     * 生成节点的显示名称
     */
    fun getDisplayName(node: ProxyNode): String {
        return "${node.name} (${node.protocol.uppercase()})"
    }
    
    /**
     * 验证节点配置
     */
    fun validateNodeConfig(node: ProxyNode): Boolean {
        return when (node.protocol.lowercase()) {
            "vmess" -> {
                node.config.containsKey("uuid") && 
                node.config.containsKey("security")
            }
            "vless" -> {
                node.config.containsKey("uuid")
            }
            "trojan" -> {
                node.config.containsKey("password")
            }
            "socks5", "http" -> true
            else -> false
        }
    }
}
