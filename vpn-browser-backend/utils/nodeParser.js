const crypto = require('crypto');

/**
 * 解析各种格式的代理节点URL
 * @param {string} url - 节点URL
 * @returns {object|null} - 解析后的节点信息
 */
function parseNodeUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    
    url = url.trim();
    
    try {
        // VMess协议解析
        if (url.startsWith('vmess://')) {
            return parseVmessUrl(url);
        }
        
        // VLess协议解析
        if (url.startsWith('vless://')) {
            return parseVlessUrl(url);
        }
        
        // Trojan协议解析
        if (url.startsWith('trojan://')) {
            return parseTrojanUrl(url);
        }
        
        // Shadowsocks协议解析
        if (url.startsWith('ss://')) {
            return parseShadowsocksUrl(url);
        }
        
        return null;
    } catch (error) {
        console.error('解析节点URL失败:', error);
        return null;
    }
}

/**
 * 解析VMess URL
 */
function parseVmessUrl(url) {
    try {
        const base64Data = url.replace('vmess://', '');
        const jsonStr = Buffer.from(base64Data, 'base64').toString('utf-8');
        const config = JSON.parse(jsonStr);
        
        return {
            name: config.ps || `VMess-${config.add}`,
            protocol: 'vmess',
            address: config.add,
            port: parseInt(config.port),
            region: extractRegionFromName(config.ps),
            country: extractCountryFromName(config.ps),
            city: extractCityFromName(config.ps),
            config: {
                id: config.id,
                aid: parseInt(config.aid) || 0,
                net: config.net || 'tcp',
                type: config.type || 'none',
                host: config.host || '',
                path: config.path || '',
                tls: config.tls || '',
                sni: config.sni || config.host || '',
                fp: config.fp || ''
            }
        };
    } catch (error) {
        throw new Error('VMess URL格式错误');
    }
}

/**
 * 解析VLess URL
 */
function parseVlessUrl(url) {
    try {
        const urlObj = new URL(url);
        const params = urlObj.searchParams;
        
        return {
            name: decodeURIComponent(urlObj.hash.substring(1)) || `VLess-${urlObj.hostname}`,
            protocol: 'vless',
            address: urlObj.hostname,
            port: parseInt(urlObj.port),
            region: extractRegionFromName(urlObj.hash),
            country: extractCountryFromName(urlObj.hash),
            city: extractCityFromName(urlObj.hash),
            config: {
                id: urlObj.username,
                encryption: params.get('encryption') || 'none',
                flow: params.get('flow') || '',
                security: params.get('security') || '',
                sni: params.get('sni') || '',
                fp: params.get('fp') || '',
                type: params.get('type') || 'tcp',
                host: params.get('host') || '',
                path: params.get('path') || '',
                headerType: params.get('headerType') || '',
                seed: params.get('seed') || ''
            }
        };
    } catch (error) {
        throw new Error('VLess URL格式错误');
    }
}

/**
 * 解析Trojan URL
 */
function parseTrojanUrl(url) {
    try {
        const urlObj = new URL(url);
        const params = urlObj.searchParams;
        
        return {
            name: decodeURIComponent(urlObj.hash.substring(1)) || `Trojan-${urlObj.hostname}`,
            protocol: 'trojan',
            address: urlObj.hostname,
            port: parseInt(urlObj.port),
            region: extractRegionFromName(urlObj.hash),
            country: extractCountryFromName(urlObj.hash),
            city: extractCityFromName(urlObj.hash),
            config: {
                password: urlObj.username,
                sni: params.get('sni') || urlObj.hostname,
                type: params.get('type') || 'tcp',
                host: params.get('host') || '',
                path: params.get('path') || '',
                security: params.get('security') || 'tls',
                fp: params.get('fp') || '',
                allowInsecure: params.get('allowInsecure') === '1'
            }
        };
    } catch (error) {
        throw new Error('Trojan URL格式错误');
    }
}

/**
 * 解析Shadowsocks URL
 */
function parseShadowsocksUrl(url) {
    try {
        const urlObj = new URL(url);
        const userInfo = Buffer.from(urlObj.username, 'base64').toString('utf-8');
        const [method, password] = userInfo.split(':');
        
        return {
            name: decodeURIComponent(urlObj.hash.substring(1)) || `SS-${urlObj.hostname}`,
            protocol: 'shadowsocks',
            address: urlObj.hostname,
            port: parseInt(urlObj.port),
            region: extractRegionFromName(urlObj.hash),
            country: extractCountryFromName(urlObj.hash),
            city: extractCityFromName(urlObj.hash),
            config: {
                method: method,
                password: password,
                plugin: urlObj.searchParams.get('plugin') || '',
                pluginOpts: urlObj.searchParams.get('plugin-opts') || ''
            }
        };
    } catch (error) {
        throw new Error('Shadowsocks URL格式错误');
    }
}

/**
 * 从节点名称中提取地区信息
 */
function extractRegionFromName(name) {
    if (!name) return '';
    
    const regions = {
        'asia': ['hk', 'hong kong', '香港', 'tw', 'taiwan', '台湾', 'sg', 'singapore', '新加坡', 'jp', 'japan', '日本', 'kr', 'korea', '韩国'],
        'america': ['us', 'usa', 'america', '美国', 'ca', 'canada', '加拿大'],
        'europe': ['uk', 'britain', '英国', 'de', 'germany', '德国', 'fr', 'france', '法国', 'nl', 'netherlands', '荷兰']
    };
    
    const lowerName = name.toLowerCase();
    
    for (const [region, keywords] of Object.entries(regions)) {
        if (keywords.some(keyword => lowerName.includes(keyword))) {
            return region;
        }
    }
    
    return '';
}

/**
 * 从节点名称中提取国家信息
 */
function extractCountryFromName(name) {
    if (!name) return '';
    
    const countries = {
        'hong kong': ['hk', 'hong kong', '香港'],
        'taiwan': ['tw', 'taiwan', '台湾'],
        'singapore': ['sg', 'singapore', '新加坡'],
        'japan': ['jp', 'japan', '日本'],
        'korea': ['kr', 'korea', '韩国'],
        'usa': ['us', 'usa', 'america', '美国'],
        'canada': ['ca', 'canada', '加拿大'],
        'uk': ['uk', 'britain', '英国'],
        'germany': ['de', 'germany', '德国'],
        'france': ['fr', 'france', '法国'],
        'netherlands': ['nl', 'netherlands', '荷兰']
    };
    
    const lowerName = name.toLowerCase();
    
    for (const [country, keywords] of Object.entries(countries)) {
        if (keywords.some(keyword => lowerName.includes(keyword))) {
            return country;
        }
    }
    
    return '';
}

/**
 * 从节点名称中提取城市信息
 */
function extractCityFromName(name) {
    if (!name) return '';
    
    const cities = {
        'hong kong': ['hk', 'hong kong', '香港'],
        'taipei': ['taipei', '台北'],
        'singapore': ['sg', 'singapore', '新加坡'],
        'tokyo': ['tokyo', '东京'],
        'osaka': ['osaka', '大阪'],
        'seoul': ['seoul', '首尔'],
        'new york': ['ny', 'new york', '纽约'],
        'los angeles': ['la', 'los angeles', '洛杉矶'],
        'london': ['london', '伦敦'],
        'frankfurt': ['frankfurt', '法兰克福'],
        'paris': ['paris', '巴黎'],
        'amsterdam': ['amsterdam', '阿姆斯特丹']
    };
    
    const lowerName = name.toLowerCase();
    
    for (const [city, keywords] of Object.entries(cities)) {
        if (keywords.some(keyword => lowerName.includes(keyword))) {
            return city;
        }
    }
    
    return '';
}

/**
 * 生成节点配置的哈希值（用于去重）
 */
function generateNodeHash(node) {
    const key = `${node.protocol}-${node.address}-${node.port}`;
    return crypto.createHash('md5').update(key).digest('hex');
}

/**
 * 验证节点配置的完整性
 */
function validateNodeConfig(node) {
    const errors = [];
    
    if (!node.name || node.name.trim().length === 0) {
        errors.push('节点名称不能为空');
    }
    
    if (!node.protocol) {
        errors.push('协议类型不能为空');
    }
    
    if (!node.address) {
        errors.push('服务器地址不能为空');
    }
    
    if (!node.port || node.port < 1 || node.port > 65535) {
        errors.push('端口号必须在1-65535之间');
    }
    
    // 协议特定验证
    if (node.protocol === 'vmess' && (!node.config || !node.config.id)) {
        errors.push('VMess协议必须包含用户ID');
    }
    
    if (node.protocol === 'vless' && (!node.config || !node.config.id)) {
        errors.push('VLess协议必须包含用户ID');
    }
    
    if (node.protocol === 'trojan' && (!node.config || !node.config.password)) {
        errors.push('Trojan协议必须包含密码');
    }
    
    if (node.protocol === 'shadowsocks' && (!node.config || !node.config.method || !node.config.password)) {
        errors.push('Shadowsocks协议必须包含加密方法和密码');
    }
    
    return errors;
}

module.exports = {
    parseNodeUrl,
    parseVmessUrl,
    parseVlessUrl,
    parseTrojanUrl,
    parseShadowsocksUrl,
    extractRegionFromName,
    extractCountryFromName,
    extractCityFromName,
    generateNodeHash,
    validateNodeConfig
};
