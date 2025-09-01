const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logOperation } = require('./operationLogs');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vpn-browser-secret-key-2024';

// 生成推广码
function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 生成订单号
function generateOrderNo() {
    return 'VPN' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// 用户注册
router.post('/register', async (req, res) => {
    try {
        const { username, password, phone, referralCode } = req.body;
        
        if (!username || !password || !phone) {
            return res.status(400).json({
                error: '用户名、密码和手机号不能为空'
            });
        }
        
        const db = getDatabase();
        
        // 检查用户名和手机号是否已存在
        db.get('SELECT id FROM users WHERE username = ? OR phone = ?', [username, phone], async (err, existingUser) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '注册失败' });
            }
            
            if (existingUser) {
                db.close();
                return res.status(400).json({ error: '用户名或手机号已存在' });
            }
            
            // 查找推荐人
            let parentAgentId = null;
            if (referralCode) {
                const referrer = await new Promise((resolve) => {
                    db.get('SELECT id, user_type FROM users WHERE referral_code = ?', [referralCode], (err, row) => {
                        resolve(err ? null : row);
                    });
                });
                
                if (referrer) {
                    parentAgentId = referrer.id;
                }
            }
            
            // 加密密码
            const hashedPassword = await bcrypt.hash(password, 10);
            const userReferralCode = generateReferralCode();
            
            // 创建用户
            db.run(`
                INSERT INTO users (username, password, phone, parent_agent_id, referral_code) 
                VALUES (?, ?, ?, ?, ?)
            `, [username, hashedPassword, phone, parentAgentId, userReferralCode], function(err) {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: '注册失败' });
                }
                
                const userId = this.lastID;
                
                // 为新用户创建3小时免费试用会员
                const startDate = new Date();
                const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // 3小时后
                const orderNo = 'FREE' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
                
                // 查找免费试用套餐ID
                db.get('SELECT id FROM membership_plans WHERE name = ?', ['免费试用'], (err, freeTrialPlan) => {
                    if (err || !freeTrialPlan) {
                        console.error('找不到免费试用套餐:', err);
                        db.close();
                        return res.status(201).json({
                            message: '注册成功',
                            data: {
                                id: userId,
                                username,
                                phone,
                                referralCode: userReferralCode
                            }
                        });
                    }
                    
                    db.run(`
                        INSERT INTO user_memberships 
                        (user_id, plan_id, plan_name, days_purchased, start_date, end_date, payment_amount, payment_method, payment_status, order_no, status) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        userId, 
                        freeTrialPlan.id, // 使用免费试用套餐ID
                        '免费试用',
                        0, // 免费试用0天（按小时计算）
                        startDate.toISOString(), 
                        endDate.toISOString(), 
                        0, // 免费
                        'free_trial', 
                        'paid', 
                        orderNo, 
                        'active'
                    ], function(membershipErr) {
                        db.close();
                        if (membershipErr) {
                            console.error('创建免费试用失败:', membershipErr);
                            // 即使免费试用创建失败，用户注册仍然成功
                        }
                        
                        res.status(201).json({
                            message: '注册成功，已获得3小时免费试用',
                            data: {
                                id: userId,
                                username,
                                phone,
                                referralCode: userReferralCode,
                                freeTrialEndTime: endDate.toISOString()
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('用户注册失败:', error);
        res.status(500).json({ error: '注册失败' });
    }
});

// 用户登录
router.post('/login', async (req, res) => {
    try {
        const { username, password, deviceId, deviceInfo } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                error: '用户名和密码不能为空'
            });
        }
        
        const db = getDatabase();
        
        // 查找用户
        db.get('SELECT * FROM users WHERE username = ? OR phone = ?', [username, username], async (err, user) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '登录失败' });
            }
            
            if (!user || !await bcrypt.compare(password, user.password)) {
                db.close();
                return res.status(401).json({ error: '用户名或密码错误' });
            }
            
            if (!user.is_active) {
                db.close();
                return res.status(401).json({ error: '账户已被禁用' });
            }
            
            // 检查设备绑定
            let deviceStatus = 'SUCCESS';
            if (deviceId) {
                // 检查是否有其他设备登录
                const existingSession = await new Promise((resolve) => {
                    db.get('SELECT * FROM device_sessions WHERE user_id = ? AND status = "active" AND device_id != ?', 
                        [user.id, deviceId], (err, row) => {
                        resolve(err ? null : row);
                    });
                });
                
                if (existingSession) {
                    // 踢出旧设备
                    db.run('UPDATE device_sessions SET status = "kicked", kicked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = "active"', 
                        [user.id]);
                    deviceStatus = 'CONFLICT';
                }
                
                // 创建新的设备会话
                db.run(`
                    INSERT INTO device_sessions (user_id, device_id, device_info, ip_address) 
                    VALUES (?, ?, ?, ?)
                `, [user.id, deviceId, deviceInfo || '', req.ip]);
                
                // 更新用户设备信息
                db.run('UPDATE users SET device_id = ?, device_info = ?, last_login_device = ?, last_login_time = CURRENT_TIMESTAMP WHERE id = ?', 
                    [deviceId, deviceInfo || '', deviceId, user.id]);
            }
            
            db.close();
            
            // 生成JWT token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username, 
                    userType: user.user_type,
                    deviceId: deviceId 
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            res.json({
                message: '登录成功',
                token,
                deviceStatus,
                user: {
                    id: user.id,
                    username: user.username,
                    phone: user.phone,
                    userType: user.user_type,
                    referralCode: user.referral_code
                }
            });
        });
    } catch (error) {
        console.error('用户登录失败:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

// 获取当前用户信息
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        
        // 查询用户信息
        db.get('SELECT id, username, phone, email, user_type, agent_level, referral_code, created_at FROM users WHERE id = ?', 
            [req.user.id], (err, user) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '获取用户信息失败' });
            }
            
            if (!user) {
                return res.status(404).json({ error: '用户不存在' });
            }
            
            res.json({
                message: '获取用户信息成功',
                data: user
            });
        });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

// 获取会员状态
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        
        // 查询用户当前会员状态
        db.get(`
            SELECT um.*, 
                   um.plan_name,
                   um.days_purchased,
                   CASE 
                       WHEN um.payment_method = 'free_trial' THEN 1
                       ELSE 0 
                   END as is_free_trial
            FROM user_memberships um
            WHERE um.user_id = ? AND um.status IN ('active', 'renewal') AND datetime(um.end_date) > datetime('now')
            ORDER BY um.end_date DESC, um.updated_at DESC, um.id DESC
            LIMIT 1
        `, [req.user.id], (err, membership) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '获取会员状态失败' });
            }
            
            const isVip = !!membership;
            const expireTime = membership ? membership.end_date : null;
            const isFreeTrialMember = membership ? !!membership.is_free_trial : false;
            
            res.json({
                message: '获取会员状态成功',
                data: {
                    isVip,
                    expireTime,
                    membership: membership || null,
                    canUseVpn: isVip,
                    isFreeTrialMember,
                    planName: membership ? membership.plan_name : null
                }
            });
        });
    } catch (error) {
        console.error('获取会员状态失败:', error);
        res.status(500).json({ error: '获取会员状态失败' });
    }
});

// 获取套餐列表
router.get('/plans', async (req, res) => {
    try {
        const db = getDatabase();
        
        // 过滤掉免费试用套餐，只显示可购买的套餐
        db.all(`
            SELECT * FROM membership_plans 
            WHERE is_active = 1 AND name != '免费试用' 
            ORDER BY sort_order ASC, price ASC
        `, (err, plans) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '获取套餐列表失败' });
            }
            
            res.json({
                message: '获取套餐列表成功',
                data: plans
            });
        });
    } catch (error) {
        console.error('获取套餐列表失败:', error);
        res.status(500).json({ error: '获取套餐列表失败' });
    }
});

// 购买套餐
router.post('/purchase', authenticateToken, async (req, res) => {
    try {
        const { planId, paymentMethod } = req.body;
        
        if (!planId) {
            return res.status(400).json({ error: '请选择套餐' });
        }
        
        const db = getDatabase();
        
        // 获取套餐信息
        db.get('SELECT * FROM membership_plans WHERE id = ? AND is_active = 1', [planId], async (err, plan) => {
            if (err || !plan) {
                db.close();
                return res.status(400).json({ error: '套餐不存在' });
            }
            
            // 查询用户当前会员状态，如果是续费则从当前到期时间开始计算
            const currentMembership = await new Promise((resolve) => {
                db.get(`
                    SELECT end_date 
                    FROM user_memberships 
                    WHERE user_id = ? AND status IN ('active', 'renewal') AND datetime(end_date) > datetime('now')
                    ORDER BY end_date DESC 
                    LIMIT 1
                `, [req.user.id], (err, row) => {
                    resolve(err ? null : row);
                });
            });
            
            // 计算开始和结束时间
            // 计算会员天数和时间
            const purchasedDays = plan.duration_days;
            let startDate, endDate;
            
            if (currentMembership) {
                // 续费：从当前到期时间开始累加天数
                startDate = new Date(currentMembership.end_date);
                endDate = new Date(startDate.getTime() + purchasedDays * 24 * 60 * 60 * 1000);
            } else {
                // 新购：从当前时间开始
                startDate = new Date();
                endDate = new Date(startDate.getTime() + purchasedDays * 24 * 60 * 60 * 1000);
            }
            const orderNo = generateOrderNo();
            
            // 查找推荐人信息
            const user = await new Promise((resolve) => {
                db.get('SELECT parent_agent_id FROM users WHERE id = ?', [req.user.id], (err, row) => {
                    resolve(err ? null : row);
                });
            });
            
            if (currentMembership) {
                // 续费：更新现有付费会员记录的到期时间（不包括免费试用）
                db.run(`
                    UPDATE user_memberships 
                    SET end_date = ?, days_purchased = days_purchased + ?, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND status IN ('active', 'renewal') AND datetime(end_date) > datetime('now') 
                    AND payment_method != 'free_trial'
                `, [endDate.toISOString(), purchasedDays, req.user.id], function(err) {
                    if (err) {
                        db.close();
                        return res.status(500).json({ error: '续费失败' });
                    }
                    
                    // 创建续费记录（用于记录每次购买）
                    db.run(`
                        INSERT INTO user_memberships 
                        (user_id, plan_id, plan_name, days_purchased, agent_id, start_date, end_date, payment_amount, payment_method, payment_status, order_no, status) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        req.user.id, planId, plan.name, purchasedDays, user?.parent_agent_id, 
                        new Date().toISOString(), endDate.toISOString(), 
                        plan.price, paymentMethod || 'unknown', 'paid', orderNo, 'renewal'
                    ], function(err) {
                        if (err) {
                            console.error('创建续费记录失败:', err);
                        }
                        
                        const membershipId = this.lastID;
                        
                        // 处理推广佣金
                        if (user?.parent_agent_id) {
                            processReferralCommission(db, user.parent_agent_id, req.user.id, membershipId, plan.price);
                        }
                        
                        db.close();
                        
                        res.json({
                            message: '续费成功',
                            data: {
                                orderNo,
                                planName: plan.name,
                                amount: plan.price,
                                startDate: startDate.toISOString(),
                                endDate: endDate.toISOString(),
                                isRenewal: true
                            }
                        });
                    });
                });
            } else {
                                // 新购：创建新的会员记录
                db.run(`
                    INSERT INTO user_memberships 
                    (user_id, plan_id, plan_name, days_purchased, agent_id, start_date, end_date, payment_amount, payment_method, payment_status, order_no, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    req.user.id, planId, plan.name, purchasedDays, user?.parent_agent_id, 
                    startDate.toISOString(), endDate.toISOString(),
                    plan.price, paymentMethod || 'unknown', 'paid', orderNo, 'active'
                ], function(err) {
                    if (err) {
                        db.close();
                        return res.status(500).json({ error: '购买失败' });
                    }
                    
                    const membershipId = this.lastID;
                    
                    // 处理推广佣金
                    if (user?.parent_agent_id) {
                        processReferralCommission(db, user.parent_agent_id, req.user.id, membershipId, plan.price);
                    }
                    
                    db.close();
                    
                    res.json({
                        message: '购买成功',
                        data: {
                            orderNo,
                            planName: plan.name,
                            amount: plan.price,
                            startDate: startDate.toISOString(),
                            endDate: endDate.toISOString(),
                            isRenewal: false
                        }
                    });
                });
            }
        });
    } catch (error) {
        console.error('购买套餐失败:', error);
        res.status(500).json({ error: '购买失败' });
    }
});

// 处理推广佣金
async function processReferralCommission(db, agentId, buyerId, membershipId, amount) {
    try {
        // 查找一级代理
        const level1Agent = await new Promise((resolve) => {
            db.get('SELECT * FROM users WHERE id = ?', [agentId], (err, row) => {
                resolve(err ? null : row);
            });
        });
        
        if (level1Agent) {
            // 一级佣金 40%
            const commission1 = amount * 0.4;
            db.run(`
                INSERT INTO referral_records (referrer_id, referee_id, membership_id, level, order_amount, commission_rate, commission_amount) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [level1Agent.id, buyerId, membershipId, 1, amount, 40, commission1]);
            
            // 查找二级代理
            if (level1Agent.parent_agent_id) {
                const level2Agent = await new Promise((resolve) => {
                    db.get('SELECT * FROM users WHERE id = ?', [level1Agent.parent_agent_id], (err, row) => {
                        resolve(err ? null : row);
                    });
                });
                
                if (level2Agent) {
                    // 二级佣金 10%
                    const commission2 = amount * 0.1;
                    db.run(`
                        INSERT INTO referral_records (referrer_id, referee_id, membership_id, level, order_amount, commission_rate, commission_amount) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [level2Agent.id, buyerId, membershipId, 2, amount, 10, commission2]);
                }
            }
        }
    } catch (error) {
        console.error('处理推广佣金失败:', error);
    }
}

// 管理员 - 获取所有用户
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', userType = '' } = req.query;
        const offset = (page - 1) * limit;
        
        const db = getDatabase();
        
        let whereClause = 'WHERE 1=1';
        let params = [];
        
        if (search) {
            whereClause += ' AND (u.username LIKE ? OR u.phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        if (userType) {
            whereClause += ' AND u.user_type = ?';
            params.push(userType);
        }
        
        // 查询用户列表
        db.all(`
            SELECT u.*, 
                   (SELECT um.end_date FROM user_memberships um 
                    WHERE um.user_id = u.id AND um.status IN ('active', 'renewal') AND um.end_date > CURRENT_TIMESTAMP 
                    ORDER BY um.end_date DESC LIMIT 1) as membership_end_date,
                   (SELECT um.status FROM user_memberships um 
                    WHERE um.user_id = u.id AND um.status IN ('active', 'renewal') AND um.end_date > CURRENT_TIMESTAMP 
                    ORDER BY um.end_date DESC LIMIT 1) as membership_status,
                   (SELECT um.plan_name FROM user_memberships um 
                    WHERE um.user_id = u.id AND um.status IN ('active', 'renewal') AND datetime(um.end_date) > datetime('now') 
                    ORDER BY um.end_date DESC LIMIT 1) as plan_name,
                   (SELECT pa.username FROM users pa 
                    WHERE pa.id = u.parent_agent_id) as parent_agent_name
            FROM users u
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset], (err, users) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取用户列表失败' });
            }
            
            // 查询总数
            db.get(`SELECT COUNT(*) as total FROM users u ${whereClause}`, params, (err, countResult) => {
                db.close();
                if (err) {
                    return res.status(500).json({ error: '获取用户总数失败' });
                }
                
                res.json({
                    message: '获取用户列表成功',
                    data: {
                        users,
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
        console.error('获取用户列表失败:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// 管理员修改用户密码
router.put('/admin/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: '新密码长度不能少于6位' });
        }
        
        const db = getDatabase();
        
        // 加密新密码
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // 先获取用户信息用于日志记录
        db.get('SELECT username FROM users WHERE id = ?', [id], (err, user) => {
            if (err || !user) {
                db.close();
                return res.status(404).json({ error: '用户不存在' });
            }
            
            db.run(`
                UPDATE users 
                SET password = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [hashedPassword, id], function(err) {
                db.close();
                if (err) {
                    console.error('修改用户密码失败:', err);
                    return res.status(500).json({ error: '修改密码失败' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: '用户不存在' });
                }
                
                // 记录操作日志
                logOperation(
                    req.user.id,
                    req.user.username,
                    'user',
                    parseInt(id),
                    user.username,
                    'password_change',
                    `管理员强制修改用户密码`,
                    null,
                    { action: '密码已修改' },
                    '管理员操作',
                    req.ip,
                    req.get('User-Agent')
                );
                
                res.json({
                    message: '密码修改成功',
                    data: { userId: parseInt(id) }
                });
            });
        });
    } catch (error) {
        console.error('修改用户密码失败:', error);
        res.status(500).json({ error: '修改密码失败' });
    }
});

// 管理员调整用户会员天数
router.put('/admin/users/:id/membership-days', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { days, operation, reason } = req.body; // operation: 'add' | 'subtract' | 'set'
        
        if (!days || !operation) {
            return res.status(400).json({ error: '天数和操作类型不能为空' });
        }
        
        if (!['add', 'subtract', 'set'].includes(operation)) {
            return res.status(400).json({ error: '操作类型必须是 add, subtract 或 set' });
        }
        
        const adjustDays = parseInt(days);
        if (isNaN(adjustDays) || adjustDays <= 0) {
            return res.status(400).json({ error: '天数必须是正整数' });
        }
        
        const db = getDatabase();
        
        // 查询用户当前活跃的会员记录
        db.get(`
            SELECT * FROM user_memberships 
            WHERE user_id = ? AND status IN ('active', 'renewal') 
            AND datetime(end_date) > datetime('now')
            ORDER BY end_date DESC, updated_at DESC, id DESC
            LIMIT 1
        `, [id], (err, membership) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '查询会员信息失败' });
            }
            
            if (!membership) {
                db.close();
                return res.status(404).json({ error: '用户没有活跃的会员记录' });
            }
            
            const currentEndDate = new Date(membership.end_date);
            let newEndDate;
            let newDaysPurchased = membership.days_purchased;
            
            switch (operation) {
                case 'add':
                    newEndDate = new Date(currentEndDate.getTime() + adjustDays * 24 * 60 * 60 * 1000);
                    newDaysPurchased += adjustDays;
                    break;
                case 'subtract':
                    newEndDate = new Date(currentEndDate.getTime() - adjustDays * 24 * 60 * 60 * 1000);
                    newDaysPurchased = Math.max(0, newDaysPurchased - adjustDays);
                    // 确保不会设置为过去的时间
                    if (newEndDate < new Date()) {
                        newEndDate = new Date();
                    }
                    break;
                case 'set':
                    const now = new Date();
                    newEndDate = new Date(now.getTime() + adjustDays * 24 * 60 * 60 * 1000);
                    newDaysPurchased = adjustDays;
                    break;
            }
            
            // 更新会员记录
            db.run(`
                UPDATE user_memberships 
                SET end_date = ?, days_purchased = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [newEndDate.toISOString(), newDaysPurchased, membership.id], function(updateErr) {
                if (updateErr) {
                    db.close();
                    return res.status(500).json({ error: '更新会员信息失败' });
                }
                
                // 获取用户信息用于日志记录
                db.get('SELECT username FROM users WHERE id = ?', [id], (err, user) => {
                    db.close();
                    if (err) {
                        console.error('获取用户信息失败:', err);
                    }
                    
                    // 记录操作日志
                    const operationText = operation === 'add' ? '增加' : operation === 'subtract' ? '减少' : '设置';
                    logOperation(
                        req.user.id,
                        req.user.username,
                        'membership',
                        parseInt(id),
                        user ? user.username : '未知用户',
                        'membership_adjust',
                        `${operationText}${adjustDays}天会员时间`,
                        {
                            old_days: membership.days_purchased,
                            old_end_date: membership.end_date
                        },
                        {
                            new_days: newDaysPurchased,
                            new_end_date: newEndDate.toISOString(),
                            operation: operation,
                            adjust_days: adjustDays
                        },
                        reason || '管理员调整',
                        req.ip,
                        req.get('User-Agent')
                    );
                    
                    res.json({
                        message: '会员时间调整成功',
                        data: {
                            userId: parseInt(id),
                            operation,
                            days: adjustDays,
                            oldEndDate: membership.end_date,
                            newEndDate: newEndDate.toISOString(),
                            newDaysPurchased
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('调整用户会员天数失败:', error);
        res.status(500).json({ error: '调整会员天数失败' });
    }
});

module.exports = router;
