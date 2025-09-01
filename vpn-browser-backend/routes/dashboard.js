const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 获取仪表板主页数据
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = getDatabase();
        
        // 获取系统概览
        db.get(`
            SELECT 
                (SELECT COUNT(*) FROM proxy_nodes) as total_nodes,
                (SELECT COUNT(*) FROM proxy_nodes WHERE is_active = 1) as active_nodes,
                (SELECT COUNT(*) FROM admins WHERE is_active = 1) as total_admins
        `, (err, overview) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取系统概览失败' });
            }
            
            // 获取协议分布
            db.all(`
                SELECT 
                    protocol,
                    COUNT(*) as count
                FROM proxy_nodes 
                WHERE is_active = 1
                GROUP BY protocol
                ORDER BY count DESC
            `, (err, protocolDistribution) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: '获取协议分布失败' });
                }
                
                // 获取地区分布
                db.all(`
                    SELECT 
                        region,
                        COUNT(*) as count
                    FROM proxy_nodes 
                    WHERE is_active = 1 AND region != ''
                    GROUP BY region
                    ORDER BY count DESC
                    LIMIT 10
                `, (err, regionDistribution) => {
                    if (err) {
                        db.close();
                        return res.status(500).json({ error: '获取地区分布失败' });
                    }
                    
                    // 获取最近操作日志
                    db.all(`
                        SELECT 
                            ol.*,
                            a.username
                        FROM operation_logs ol
                        LEFT JOIN admins a ON ol.admin_id = a.id
                        ORDER BY ol.created_at DESC
                        LIMIT 10
                    `, (err, recentLogs) => {
                        db.close();
                        if (err) {
                            return res.status(500).json({ error: '获取操作日志失败' });
                        }
                        
                        res.json({
                            message: '获取仪表板数据成功',
                            data: {
                                overview: overview || {
                                    total_nodes: 0,
                                    active_nodes: 0,
                                    total_admins: 0,
                                    active_days: 0
                                },
                                today: {
                                    today_traffic: 0,
                                    today_connections: 0,
                                    avg_latency: 0,
                                    avg_success_rate: 0
                                },
                                traffic_trend: [],
                                protocol_distribution: protocolDistribution || [],
                                region_distribution: regionDistribution || [],
                                recent_logs: recentLogs || []
                            },
                            timestamp: new Date().toISOString()
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('获取仪表板数据失败:', error);
        res.status(500).json({ error: '获取仪表板数据失败' });
    }
});

// 获取系统状态
router.get('/system-status', authenticateToken, requireAdmin, (req, res) => {
    try {
        const db = getDatabase();
        
        // 获取数据库状态
        db.get('SELECT COUNT(*) as table_count FROM sqlite_master WHERE type="table"', (err, dbStatus) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '获取数据库状态失败' });
            }
            
            res.json({
                message: '获取系统状态成功',
                data: {
                    server: {
                        uptime: process.uptime(),
                        memory_usage: process.memoryUsage(),
                        node_version: process.version,
                        platform: process.platform
                    },
                    database: {
                        status: 'connected',
                        tables: dbStatus.table_count
                    },
                    nodes: {
                        total: 0,
                        online: 0,
                        offline: 0,
                        health_score: 100,
                        health_status: 'excellent'
                    }
                },
                timestamp: new Date().toISOString()
            });
        });
    } catch (error) {
        console.error('获取系统状态失败:', error);
        res.status(500).json({ error: '获取系统状态失败' });
    }
});

module.exports = router;