const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { parseNodeUrl } = require('../utils/nodeParser');

const router = express.Router();

// 获取所有节点（公开接口，供客户端调用）
router.get('/', async (req, res) => {
    try {
        const db = getDatabase();
        const isActive = req.query.active !== undefined ? parseInt(req.query.active) : 1;
        
        let query = 'SELECT * FROM proxy_nodes WHERE is_active = ? ORDER BY priority DESC, created_at DESC';
        
        db.all(query, [isActive], (err, rows) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '获取节点列表失败' });
            }
            
            // 对于公开接口，只返回安卓客户端需要的信息
            const publicNodes = rows.map(node => ({
                id: node.id.toString(), // 安卓期望字符串类型的id
                name: node.name,
                protocol: node.protocol,
                address: node.address,
                port: node.port,
                config: node.config ? JSON.parse(node.config) : {}
            }));
            
            res.json(publicNodes);
        });
    } catch (error) {
        console.error('获取节点列表失败:', error);
        res.status(500).json({ 
            error: '获取节点列表失败' 
        });
    }
});

// 获取节点详情（管理员接口）
router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = getDatabase();
        
        db.all('SELECT * FROM proxy_nodes ORDER BY created_at DESC', (err, rows) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '获取节点列表失败' });
            }
            
            const nodes = rows.map(node => ({
                ...node,
                config: node.config ? JSON.parse(node.config) : {}
            }));
            
            res.json({
                message: '获取节点列表成功',
                data: nodes,
                total: nodes.length
            });
        });
    } catch (error) {
        console.error('获取节点列表失败:', error);
        res.status(500).json({ 
            error: '获取节点列表失败' 
        });
    }
});

// 创建节点
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name, protocol, address, port, config,
            region, country, city, priority, max_connections
        } = req.body;
        
        // 验证必填字段
        if (!name || !protocol || !address || !port) {
            return res.status(400).json({
                error: '节点名称、协议、地址和端口不能为空'
            });
        }
        
        const db = getDatabase();
        
        db.run(`
            INSERT INTO proxy_nodes 
            (name, protocol, address, port, config, region, country, city, priority, max_connections, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name, protocol, address, parseInt(port), 
            JSON.stringify(config || {}), 
            region || '', country || '', city || '', 
            priority || 0, max_connections || 1000, req.user.id
        ], function(err) {
            db.close();
            if (err) {
                return res.status(500).json({ error: '创建节点失败' });
            }
            
            res.status(201).json({
                message: '节点创建成功',
                data: {
                    id: this.lastID,
                    name, protocol, address, port,
                    config: config || {},
                    region, country, city, priority, max_connections,
                    created_at: new Date().toISOString()
                }
            });
        });
    } catch (error) {
        console.error('创建节点失败:', error);
        res.status(500).json({ 
            error: '创建节点失败' 
        });
    }
});

// 批量导入节点
router.post('/batch-import', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { nodeUrls } = req.body;
        
        if (!nodeUrls || !Array.isArray(nodeUrls) || nodeUrls.length === 0) {
            return res.status(400).json({
                error: '请提供有效的节点链接数组'
            });
        }
        
        const db = getDatabase();
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const nodeUrl of nodeUrls) {
            try {
                const nodeData = parseNodeUrl(nodeUrl);
                if (nodeData) {
                    // 插入节点到数据库
                    await new Promise((resolve, reject) => {
                        db.run(`
                            INSERT INTO proxy_nodes 
                            (name, protocol, address, port, config, region, country, city, priority, max_connections, created_by) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            nodeData.name, nodeData.protocol, nodeData.address, nodeData.port,
                            JSON.stringify(nodeData.config || {}),
                            nodeData.region || '', nodeData.country || '', nodeData.city || '',
                            nodeData.priority || 0, nodeData.max_connections || 1000, req.user.id
                        ], function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(this.lastID);
                            }
                        });
                    });
                    successCount++;
                } else {
                    errorCount++;
                    errors.push(`无法解析节点链接: ${nodeUrl.substring(0, 50)}...`);
                }
            } catch (error) {
                errorCount++;
                errors.push(`导入失败: ${error.message}`);
            }
        }
        
        db.close();
        
        res.json({
            message: '批量导入完成',
            data: {
                successCount,
                errorCount,
                totalCount: nodeUrls.length,
                errors: errors.slice(0, 10) // 只返回前10个错误
            }
        });
    } catch (error) {
        console.error('批量导入节点失败:', error);
        res.status(500).json({ 
            error: '批量导入节点失败' 
        });
    }
});

// 更新节点
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, protocol, address, port, config,
            region, country, city, priority, max_connections, is_active
        } = req.body;
        
        const db = getDatabase();
        
        db.run(`
            UPDATE proxy_nodes 
            SET name = ?, protocol = ?, address = ?, port = ?, config = ?, 
                region = ?, country = ?, city = ?, priority = ?, max_connections = ?, 
                is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name, protocol, address, parseInt(port), 
            JSON.stringify(config || {}), 
            region || '', country || '', city || '', 
            priority || 0, max_connections || 1000, 
            is_active !== undefined ? is_active : 1, id
        ], function(err) {
            db.close();
            if (err) {
                return res.status(500).json({ error: '更新节点失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '节点不存在' });
            }
            
            res.json({
                message: '节点更新成功',
                data: { id: parseInt(id) }
            });
        });
    } catch (error) {
        console.error('更新节点失败:', error);
        res.status(500).json({ 
            error: '更新节点失败' 
        });
    }
});

// 删除节点
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const db = getDatabase();
        
        db.run('DELETE FROM proxy_nodes WHERE id = ?', [id], function(err) {
            db.close();
            if (err) {
                return res.status(500).json({ error: '删除节点失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '节点不存在' });
            }
            
            res.json({
                message: '节点删除成功',
                data: { id: parseInt(id) }
            });
        });
    } catch (error) {
        console.error('删除节点失败:', error);
        res.status(500).json({ 
            error: '删除节点失败' 
        });
    }
});

module.exports = router;