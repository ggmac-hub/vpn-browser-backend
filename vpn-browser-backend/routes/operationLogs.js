const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 记录操作日志的通用函数
function logOperation(adminId, adminUsername, targetType, targetId, targetName, actionType, actionDescription, oldValues = null, newValues = null, reason = '', ipAddress = '', userAgent = '') {
    const db = getDatabase();
    
    db.run(`
        INSERT INTO operation_logs 
        (admin_id, admin_username, target_type, target_id, target_name, action_type, action_description, old_values, new_values, reason, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        adminId, adminUsername, targetType, targetId, targetName, actionType, actionDescription,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        reason, ipAddress, userAgent
    ], function(err) {
        if (err) {
            console.error('记录操作日志失败:', err);
        }
        db.close();
    });
}

// 获取操作日志列表
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, targetType, actionType, adminUsername, startDate, endDate } = req.query;
        const offset = (page - 1) * limit;
        
        const db = getDatabase();
        
        // 构建查询条件
        let whereClause = 'WHERE 1=1';
        const params = [];
        
        if (targetType) {
            whereClause += ' AND target_type = ?';
            params.push(targetType);
        }
        
        if (actionType) {
            whereClause += ' AND action_type = ?';
            params.push(actionType);
        }
        
        if (adminUsername) {
            whereClause += ' AND admin_username LIKE ?';
            params.push(`%${adminUsername}%`);
        }
        
        if (startDate) {
            whereClause += ' AND date(created_at) >= date(?)';
            params.push(startDate);
        }
        
        if (endDate) {
            whereClause += ' AND date(created_at) <= date(?)';
            params.push(endDate);
        }
        
        // 查询总数
        db.get(`SELECT COUNT(*) as total FROM operation_logs ${whereClause}`, params, (err, countResult) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取日志总数失败' });
            }
            
            // 查询日志列表
            db.all(`
                SELECT * FROM operation_logs 
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, parseInt(limit), offset], (err, logs) => {
                db.close();
                if (err) {
                    return res.status(500).json({ error: '获取操作日志失败' });
                }
                
                // 解析JSON字段
                const processedLogs = logs.map(log => ({
                    ...log,
                    old_values: log.old_values ? JSON.parse(log.old_values) : null,
                    new_values: log.new_values ? JSON.parse(log.new_values) : null
                }));
                
                res.json({
                    message: '获取操作日志成功',
                    data: {
                        logs: processedLogs,
                        pagination: {
                            page: parseInt(page),
                            limit: parseInt(limit),
                            total: countResult.total,
                            pages: Math.ceil(countResult.total / limit)
                        }
                    }
                });
            });
        });
    } catch (error) {
        console.error('获取操作日志失败:', error);
        res.status(500).json({ error: '获取操作日志失败' });
    }
});

// 获取操作日志统计信息
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = getDatabase();
        
        // 获取各种统计信息
        db.all(`
            SELECT 
                target_type,
                action_type,
                COUNT(*) as count,
                DATE(created_at) as date
            FROM operation_logs 
            WHERE created_at >= datetime('now', '-30 days')
            GROUP BY target_type, action_type, DATE(created_at)
            ORDER BY created_at DESC
        `, [], (err, stats) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取统计信息失败' });
            }
            
            // 获取今日操作统计
            db.get(`
                SELECT COUNT(*) as today_count
                FROM operation_logs 
                WHERE date(created_at) = date('now')
            `, [], (err, todayStats) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: '获取今日统计失败' });
                }
                
                // 获取最活跃的管理员
                db.all(`
                    SELECT admin_username, COUNT(*) as operation_count
                    FROM operation_logs 
                    WHERE created_at >= datetime('now', '-7 days')
                    GROUP BY admin_username
                    ORDER BY operation_count DESC
                    LIMIT 5
                `, [], (err, activeAdmins) => {
                    db.close();
                    if (err) {
                        return res.status(500).json({ error: '获取管理员统计失败' });
                    }
                    
                    res.json({
                        message: '获取统计信息成功',
                        data: {
                            dailyStats: stats,
                            todayCount: todayStats.today_count,
                            activeAdmins
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('获取统计信息失败:', error);
        res.status(500).json({ error: '获取统计信息失败' });
    }
});

// 导出日志记录函数
module.exports = { router, logOperation };
