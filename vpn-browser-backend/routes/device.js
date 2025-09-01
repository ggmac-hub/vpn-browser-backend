const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 检查设备状态
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const { deviceId } = req.query;
        const userId = req.user.id;
        
        if (!deviceId) {
            return res.status(400).json({ error: '设备ID不能为空' });
        }
        
        const db = getDatabase();
        
        // 检查当前设备会话
        db.get(`
            SELECT ds.*, u.username, 
                   um.end_date as membership_end_date,
                   CASE WHEN um.end_date > CURRENT_TIMESTAMP THEN 1 ELSE 0 END as is_vip
            FROM device_sessions ds
            LEFT JOIN users u ON ds.user_id = u.id
            LEFT JOIN user_memberships um ON u.id = um.user_id AND um.status = 'active' AND um.end_date > CURRENT_TIMESTAMP
            WHERE ds.user_id = ? AND ds.device_id = ? AND ds.status = 'active'
        `, [userId, deviceId], (err, session) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '检查设备状态失败' });
            }
            
            if (!session) {
                return res.json({
                    message: '设备未登录或已失效',
                    data: {
                        isValid: false,
                        canUseVpn: false,
                        reason: 'DEVICE_NOT_ACTIVE'
                    }
                });
            }
            
            // 更新最后活跃时间
            const updateDb = getDatabase();
            updateDb.run('UPDATE device_sessions SET last_active_time = CURRENT_TIMESTAMP WHERE id = ?', [session.id]);
            updateDb.close();
            
            res.json({
                message: '设备状态检查成功',
                data: {
                    isValid: true,
                    canUseVpn: session.is_vip === 1,
                    membershipEndDate: session.membership_end_date,
                    lastActiveTime: session.last_active_time,
                    loginTime: session.login_time
                }
            });
        });
    } catch (error) {
        console.error('检查设备状态失败:', error);
        res.status(500).json({ error: '检查设备状态失败' });
    }
});

// 强制下线设备
router.post('/kick', authenticateToken, async (req, res) => {
    try {
        const { targetDeviceId } = req.body;
        const userId = req.user.id;
        
        if (!targetDeviceId) {
            return res.status(400).json({ error: '目标设备ID不能为空' });
        }
        
        const db = getDatabase();
        
        db.run(`
            UPDATE device_sessions 
            SET status = 'kicked', kicked_at = CURRENT_TIMESTAMP 
            WHERE user_id = ? AND device_id = ? AND status = 'active'
        `, [userId, targetDeviceId], function(err) {
            db.close();
            if (err) {
                return res.status(500).json({ error: '强制下线失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '设备不存在或已下线' });
            }
            
            res.json({
                message: '设备强制下线成功',
                data: { deviceId: targetDeviceId }
            });
        });
    } catch (error) {
        console.error('强制下线设备失败:', error);
        res.status(500).json({ error: '强制下线失败' });
    }
});

// 获取用户设备列表
router.get('/sessions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const db = getDatabase();
        
        db.all(`
            SELECT ds.*, 
                   CASE 
                       WHEN ds.status = 'active' THEN '在线'
                       WHEN ds.status = 'kicked' THEN '已踢出'
                       ELSE '已过期'
                   END as status_text
            FROM device_sessions ds
            WHERE ds.user_id = ?
            ORDER BY ds.login_time DESC
            LIMIT 10
        `, [userId], (err, sessions) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '获取设备列表失败' });
            }
            
            res.json({
                message: '获取设备列表成功',
                data: sessions
            });
        });
    } catch (error) {
        console.error('获取设备列表失败:', error);
        res.status(500).json({ error: '获取设备列表失败' });
    }
});

// 管理员 - 获取所有设备会话
router.get('/admin/sessions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', status = '' } = req.query;
        const offset = (page - 1) * limit;
        
        const db = getDatabase();
        
        let whereClause = 'WHERE 1=1';
        let params = [];
        
        if (search) {
            whereClause += ' AND (u.username LIKE ? OR u.phone LIKE ? OR ds.device_id LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        if (status) {
            whereClause += ' AND ds.status = ?';
            params.push(status);
        }
        
        db.all(`
            SELECT ds.*, u.username, u.phone, u.user_type,
                   um.end_date as membership_end_date,
                   CASE WHEN um.end_date > CURRENT_TIMESTAMP THEN 1 ELSE 0 END as is_vip,
                   kicked_admin.username as kicked_by_name
            FROM device_sessions ds
            LEFT JOIN users u ON ds.user_id = u.id
            LEFT JOIN user_memberships um ON u.id = um.user_id AND um.status = 'active' AND um.end_date > CURRENT_TIMESTAMP
            LEFT JOIN admins kicked_admin ON ds.kicked_by = kicked_admin.id
            ${whereClause}
            ORDER BY ds.login_time DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset], (err, sessions) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取设备会话列表失败' });
            }
            
            db.get(`
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN ds.status = 'active' THEN 1 ELSE 0 END) as active_count,
                       SUM(CASE WHEN ds.status = 'kicked' THEN 1 ELSE 0 END) as kicked_count
                FROM device_sessions ds
                LEFT JOIN users u ON ds.user_id = u.id
                ${whereClause}
            `, params, (err, stats) => {
                db.close();
                if (err) {
                    return res.status(500).json({ error: '获取设备统计失败' });
                }
                
                res.json({
                    message: '获取设备会话列表成功',
                    data: {
                        sessions,
                        stats: {
                            total: stats.total,
                            activeCount: stats.active_count,
                            kickedCount: stats.kicked_count
                        },
                        pagination: {
                            page: parseInt(page),
                            limit: parseInt(limit),
                            total: stats.total,
                            pages: Math.ceil(stats.total / limit)
                        }
                    }
                });
            });
        });
    } catch (error) {
        console.error('获取设备会话列表失败:', error);
        res.status(500).json({ error: '获取设备会话列表失败' });
    }
});

// 管理员 - 强制下线指定设备
router.post('/admin/kick/:sessionId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { reason } = req.body;
        
        const db = getDatabase();
        
        db.run(`
            UPDATE device_sessions 
            SET status = 'kicked', kicked_by = ?, kicked_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND status = 'active'
        `, [req.user.id, sessionId], function(err) {
            if (err) {
                db.close();
                return res.status(500).json({ error: '强制下线失败' });
            }
            
            if (this.changes === 0) {
                db.close();
                return res.status(404).json({ error: '设备会话不存在或已下线' });
            }
            
            // 记录操作日志
            db.run(`
                INSERT INTO operation_logs (admin_id, action, target_type, target_id, details, ip_address) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                req.user.id, 'KICK_DEVICE', 'device_session', sessionId,
                JSON.stringify({ reason: reason || '管理员强制下线' }),
                req.ip
            ]);
            
            db.close();
            
            res.json({
                message: '设备强制下线成功',
                data: { sessionId: parseInt(sessionId) }
            });
        });
    } catch (error) {
        console.error('管理员强制下线设备失败:', error);
        res.status(500).json({ error: '强制下线失败' });
    }
});

// 管理员 - 批量下线用户所有设备
router.post('/admin/kick-user/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        
        const db = getDatabase();
        
        db.run(`
            UPDATE device_sessions 
            SET status = 'kicked', kicked_by = ?, kicked_at = CURRENT_TIMESTAMP 
            WHERE user_id = ? AND status = 'active'
        `, [req.user.id, userId], function(err) {
            if (err) {
                db.close();
                return res.status(500).json({ error: '批量下线失败' });
            }
            
            // 记录操作日志
            db.run(`
                INSERT INTO operation_logs (admin_id, action, target_type, target_id, details, ip_address) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                req.user.id, 'KICK_USER_DEVICES', 'user', userId,
                JSON.stringify({ 
                    reason: reason || '管理员批量下线用户设备',
                    kickedCount: this.changes
                }),
                req.ip
            ]);
            
            db.close();
            
            res.json({
                message: `成功下线用户的 ${this.changes} 个设备`,
                data: { 
                    userId: parseInt(userId),
                    kickedCount: this.changes
                }
            });
        });
    } catch (error) {
        console.error('批量下线用户设备失败:', error);
        res.status(500).json({ error: '批量下线失败' });
    }
});

// 清理过期会话
router.post('/admin/cleanup', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { days = 30 } = req.body;
        
        const db = getDatabase();
        
        db.run(`
            DELETE FROM device_sessions 
            WHERE status != 'active' AND created_at < datetime('now', '-${days} days')
        `, function(err) {
            db.close();
            if (err) {
                return res.status(500).json({ error: '清理过期会话失败' });
            }
            
            res.json({
                message: `成功清理 ${this.changes} 条过期设备会话记录`,
                data: { 
                    cleanedCount: this.changes,
                    days: days
                }
            });
        });
    } catch (error) {
        console.error('清理过期会话失败:', error);
        res.status(500).json({ error: '清理过期会话失败' });
    }
});

// 获取设备统计信息
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = getDatabase();
        
        const stats = await Promise.all([
            // 总设备会话数
            new Promise((resolve) => {
                db.get('SELECT COUNT(*) as count FROM device_sessions', (err, row) => {
                    resolve(err ? 0 : row.count);
                });
            }),
            
            // 活跃设备数
            new Promise((resolve) => {
                db.get('SELECT COUNT(*) as count FROM device_sessions WHERE status = "active"', (err, row) => {
                    resolve(err ? 0 : row.count);
                });
            }),
            
            // 今日新增设备
            new Promise((resolve) => {
                db.get('SELECT COUNT(*) as count FROM device_sessions WHERE DATE(login_time) = DATE("now")', (err, row) => {
                    resolve(err ? 0 : row.count);
                });
            }),
            
            // 本周新增设备
            new Promise((resolve) => {
                db.get('SELECT COUNT(*) as count FROM device_sessions WHERE login_time >= datetime("now", "-7 days")', (err, row) => {
                    resolve(err ? 0 : row.count);
                });
            }),
            
            // 设备冲突次数（今日）
            new Promise((resolve) => {
                db.get('SELECT COUNT(*) as count FROM device_sessions WHERE status = "kicked" AND DATE(kicked_at) = DATE("now")', (err, row) => {
                    resolve(err ? 0 : row.count);
                });
            })
        ]);
        
        db.close();
        
        res.json({
            message: '获取设备统计成功',
            data: {
                totalSessions: stats[0],
                activeSessions: stats[1],
                todayNewSessions: stats[2],
                weekNewSessions: stats[3],
                todayConflicts: stats[4]
            }
        });
    } catch (error) {
        console.error('获取设备统计失败:', error);
        res.status(500).json({ error: '获取设备统计失败' });
    }
});

module.exports = router;
