const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logOperation } = require('./operationLogs');

const router = express.Router();

// 获取技术支持信息（公开接口，供客户端调用）
router.get('/', async (req, res) => {
    try {
        const db = getDatabase();
        db.get(`
            SELECT * FROM tech_support 
            WHERE is_active = 1 
            ORDER BY updated_at DESC 
            LIMIT 1
        `, (err, row) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '获取技术支持信息失败' });
            }
            
            const supportInfo = row || {
                qq: '888888888',
                wechat: 'vpn_support_2024',
                telegram: '',
                email: '',
                website: '',
                support_hours: '工作日 9:00-18:00 (北京时间)'
            };
            
            // 格式化为安卓客户端期望的格式
            const response = {
                qq: supportInfo.qq || '',
                wechat: supportInfo.wechat || '',
                telegram: supportInfo.telegram || '',
                email: supportInfo.email || '',
                website: supportInfo.website || '',
                support_hours: supportInfo.support_hours || '工作日 9:00-18:00',
                last_updated: supportInfo.updated_at ? new Date(supportInfo.updated_at).getTime() : Date.now()
            };
            
            res.json(response);
        });
    } catch (error) {
        console.error('获取技术支持信息失败:', error);
        res.status(500).json({ 
            error: '获取技术支持信息失败' 
        });
    }
});

// 更新技术支持信息（需要管理员权限）
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { qq, wechat, telegram, email, website, support_hours } = req.body;
        
        const supportData = {
            qq: qq || '',
            wechat: wechat || '',
            telegram: telegram || '',
            email: email || '',
            website: website || '',
            support_hours: support_hours || '工作日 9:00-18:00 (北京时间)'
        };
        
        const db = getDatabase();
        
        // 先获取旧的技术支持信息用于日志记录
        db.get('SELECT * FROM tech_support WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1', (err, oldData) => {
            if (err) {
                console.error('获取旧技术支持信息失败:', err);
            }
            
            // 先禁用旧记录
            db.run('UPDATE tech_support SET is_active = 0', (err) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: '更新失败' });
                }
                
                // 插入新记录
                db.run(`
                    INSERT INTO tech_support (qq, wechat, telegram, email, website, support_hours) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [supportData.qq, supportData.wechat, supportData.telegram, 
                    supportData.email, supportData.website, supportData.support_hours], 
                function(err) {
                    db.close();
                    if (err) {
                        return res.status(500).json({ error: '更新失败' });
                    }
                    
                    // 记录操作日志
                    logOperation(
                        req.user.id,
                        req.user.username,
                        'tech_support',
                        this.lastID,
                        '技术支持信息',
                        'update',
                        '更新技术支持联系信息',
                        oldData ? {
                            qq: oldData.qq,
                            wechat: oldData.wechat,
                            telegram: oldData.telegram,
                            email: oldData.email,
                            website: oldData.website,
                            support_hours: oldData.support_hours
                        } : null,
                        supportData,
                        '管理员更新',
                        req.ip,
                        req.get('User-Agent')
                    );
                    
                    res.json({
                        message: '技术支持信息更新成功',
                        data: {
                            id: this.lastID,
                            ...supportData,
                            updated_at: new Date().toISOString()
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('更新技术支持信息失败:', error);
        res.status(500).json({ 
            error: '更新技术支持信息失败' 
        });
    }
});

module.exports = router;