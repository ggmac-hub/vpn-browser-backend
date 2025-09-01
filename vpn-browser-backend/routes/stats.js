const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 获取统计概览
router.get('/overview', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = getDatabase();
        
        db.get(`
            SELECT 
                COUNT(*) as total_nodes,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_nodes,
                COUNT(DISTINCT protocol) as protocols,
                COUNT(DISTINCT region) as regions
            FROM proxy_nodes
        `, (err, summary) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '获取统计概览失败' });
            }
            
            res.json({
                message: '获取统计概览成功',
                data: {
                    summary: summary || {
                        total_nodes: 0,
                        active_nodes: 0,
                        protocols: 0,
                        regions: 0
                    }
                }
            });
        });
    } catch (error) {
        console.error('获取统计概览失败:', error);
        res.status(500).json({ error: '获取统计概览失败' });
    }
});

module.exports = router;