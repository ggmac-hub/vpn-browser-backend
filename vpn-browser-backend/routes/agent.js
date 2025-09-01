const express = require('express');
const { getDatabase } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 代理中间件 - 验证代理权限
const requireAgent = (req, res, next) => {
    if (req.user.userType !== 'agent' && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要代理权限' });
    }
    next();
};

// 代理登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                error: '用户名和密码不能为空'
            });
        }
        
        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');
        const db = getDatabase();
        
        // 查找代理用户
        db.get('SELECT * FROM users WHERE username = ? AND user_type = "agent" AND is_active = 1', [username], async (err, user) => {
            db.close();
            
            if (err) {
                return res.status(500).json({ error: '登录失败' });
            }
            
            if (!user) {
                return res.status(401).json({ error: '用户名或密码错误' });
            }
            
            // 验证密码
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ error: '用户名或密码错误' });
            }
            
            // 生成JWT token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username, 
                    userType: user.user_type,
                    agentLevel: user.agent_level,
                    parentAgentId: user.parent_agent_id
                },
                process.env.JWT_SECRET || 'vpn-browser-secret',
                { expiresIn: '7d' }
            );
            
            // 更新最后登录时间
            const updateDb = getDatabase();
            updateDb.run('UPDATE users SET last_login_time = datetime("now") WHERE id = ?', [user.id]);
            updateDb.close();
            
            res.json({
                message: '登录成功',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    phone: user.phone,
                    userType: user.user_type,
                    agentLevel: user.agent_level,
                    parentAgentId: user.parent_agent_id,
                    referralCode: user.referral_code
                }
            });
        });
    } catch (error) {
        console.error('代理登录失败:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

// 代理仪表板数据
router.get('/dashboard', authenticateToken, requireAgent, async (req, res) => {
    try {
        const db = getDatabase();
        const agentId = req.user.id;
        
        // 获取统计数据
        const stats = await Promise.all([
            // 直属会员数量
            new Promise((resolve) => {
                db.get('SELECT COUNT(*) as count FROM users WHERE parent_agent_id = ? AND user_type = "member"', 
                    [agentId], (err, row) => resolve(err ? 0 : row.count));
            }),
            
            // 下级代理数量
            new Promise((resolve) => {
                db.get('SELECT COUNT(*) as count FROM users WHERE parent_agent_id = ? AND user_type = "agent"', 
                    [agentId], (err, row) => resolve(err ? 0 : row.count));
            }),
            
            // 今日收入
            new Promise((resolve) => {
                db.get(`SELECT SUM(commission_amount) as amount FROM referral_records 
                        WHERE referrer_id = ? AND DATE(created_at) = DATE('now') AND status = 'paid'`, 
                    [agentId], (err, row) => resolve(err ? 0 : (row.amount || 0)));
            }),
            
            // 本月收入
            new Promise((resolve) => {
                db.get(`SELECT SUM(commission_amount) as amount FROM referral_records 
                        WHERE referrer_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') AND status = 'paid'`, 
                    [agentId], (err, row) => resolve(err ? 0 : (row.amount || 0)));
            }),
            
            // 总收入
            new Promise((resolve) => {
                db.get('SELECT SUM(commission_amount) as amount FROM referral_records WHERE referrer_id = ? AND status = "paid"', 
                    [agentId], (err, row) => resolve(err ? 0 : (row.amount || 0)));
            }),
            
            // 待提现金额
            new Promise((resolve) => {
                db.get('SELECT SUM(commission_amount) as amount FROM referral_records WHERE referrer_id = ? AND status = "pending"', 
                    [agentId], (err, row) => resolve(err ? 0 : (row.amount || 0)));
            })
        ]);
        
        db.close();
        
        res.json({
            message: '获取代理仪表板数据成功',
            data: {
                directMembers: stats[0],
                subAgents: stats[1],
                todayIncome: stats[2],
                monthIncome: stats[3],
                totalIncome: stats[4],
                pendingAmount: stats[5]
            }
        });
    } catch (error) {
        console.error('获取代理仪表板数据失败:', error);
        res.status(500).json({ error: '获取仪表板数据失败' });
    }
});

// 获取直属会员列表
router.get('/members', authenticateToken, requireAgent, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;
        const agentId = req.user.id;
        
        const db = getDatabase();
        
        let whereClause = 'WHERE u.parent_agent_id = ? AND u.user_type = "member"';
        let params = [agentId];
        
        if (search) {
            whereClause += ' AND (u.username LIKE ? OR u.phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        // 查询会员列表
        db.all(`
            SELECT u.id, u.username, u.phone, u.created_at, u.last_login_time, u.is_active,
                   um.end_date as membership_end_date,
                   um.status as membership_status,
                   mp.name as plan_name,
                   CASE 
                       WHEN um.end_date > CURRENT_TIMESTAMP THEN 1 
                       ELSE 0 
                   END as is_vip
            FROM users u
            LEFT JOIN user_memberships um ON u.id = um.user_id AND um.status = 'active' AND um.end_date > CURRENT_TIMESTAMP
            LEFT JOIN membership_plans mp ON um.plan_id = mp.id
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset], (err, members) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取会员列表失败' });
            }
            
            // 查询总数
            db.get(`SELECT COUNT(*) as total FROM users u ${whereClause}`, params, (err, countResult) => {
                db.close();
                if (err) {
                    return res.status(500).json({ error: '获取会员总数失败' });
                }
                
                res.json({
                    message: '获取直属会员列表成功',
                    data: {
                        members,
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
        console.error('获取直属会员列表失败:', error);
        res.status(500).json({ error: '获取会员列表失败' });
    }
});

// 获取下级代理列表
router.get('/sub-agents', authenticateToken, requireAgent, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const agentId = req.user.id;
        
        const db = getDatabase();
        
        // 查询下级代理列表
        db.all(`
            SELECT u.id, u.username, u.phone, u.referral_code, u.created_at, u.last_login_time, u.is_active,
                   COUNT(DISTINCT sub_members.id) as member_count,
                   SUM(CASE WHEN rr.status = 'paid' THEN rr.commission_amount ELSE 0 END) as total_commission
            FROM users u
            LEFT JOIN users sub_members ON sub_members.parent_agent_id = u.id AND sub_members.user_type = 'member'
            LEFT JOIN referral_records rr ON rr.referrer_id = u.id
            WHERE u.parent_agent_id = ? AND u.user_type = 'agent'
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [agentId, limit, offset], (err, agents) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取下级代理列表失败' });
            }
            
            // 查询总数
            db.get('SELECT COUNT(*) as total FROM users WHERE parent_agent_id = ? AND user_type = "agent"', 
                [agentId], (err, countResult) => {
                db.close();
                if (err) {
                    return res.status(500).json({ error: '获取代理总数失败' });
                }
                
                res.json({
                    message: '获取下级代理列表成功',
                    data: {
                        agents,
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
        console.error('获取下级代理列表失败:', error);
        res.status(500).json({ error: '获取代理列表失败' });
    }
});

// 获取佣金统计
router.get('/commission', authenticateToken, requireAgent, async (req, res) => {
    try {
        const { page = 1, limit = 20, status = '' } = req.query;
        const offset = (page - 1) * limit;
        const agentId = req.user.id;
        
        const db = getDatabase();
        
        let whereClause = 'WHERE rr.referrer_id = ?';
        let params = [agentId];
        
        if (status) {
            whereClause += ' AND rr.status = ?';
            params.push(status);
        }
        
        // 查询佣金记录
        db.all(`
            SELECT rr.*, u.username as referee_name, um.order_no, mp.name as plan_name
            FROM referral_records rr
            LEFT JOIN users u ON rr.referee_id = u.id
            LEFT JOIN user_memberships um ON rr.membership_id = um.id
            LEFT JOIN membership_plans mp ON um.plan_id = mp.id
            ${whereClause}
            ORDER BY rr.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset], (err, records) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取佣金记录失败' });
            }
            
            // 查询总数和统计
            db.get(`SELECT COUNT(*) as total, 
                           SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as paid_amount,
                           SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END) as pending_amount
                    FROM referral_records ${whereClause}`, params, (err, stats) => {
                db.close();
                if (err) {
                    return res.status(500).json({ error: '获取佣金统计失败' });
                }
                
                res.json({
                    message: '获取佣金统计成功',
                    data: {
                        records,
                        stats: {
                            paidAmount: stats.paid_amount || 0,
                            pendingAmount: stats.pending_amount || 0
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
        console.error('获取佣金统计失败:', error);
        res.status(500).json({ error: '获取佣金统计失败' });
    }
});

// 申请提现
router.post('/withdraw', authenticateToken, requireAgent, async (req, res) => {
    try {
        const { amount, withdrawalMethod, bankInfo } = req.body;
        const agentId = req.user.id;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: '提现金额必须大于0' });
        }
        
        if (!withdrawalMethod || !['bank', 'alipay', 'wechat'].includes(withdrawalMethod)) {
            return res.status(400).json({ error: '请选择正确的提现方式' });
        }
        
        const db = getDatabase();
        
        // 检查可提现金额
        db.get('SELECT SUM(commission_amount) as available FROM referral_records WHERE referrer_id = ? AND status = "pending"', 
            [agentId], (err, result) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '检查余额失败' });
            }
            
            const availableAmount = result.available || 0;
            if (amount > availableAmount) {
                db.close();
                return res.status(400).json({ error: '提现金额超过可用余额' });
            }
            
            // 创建提现申请
            const withdrawalData = {
                user_id: agentId,
                amount: amount,
                withdrawal_method: withdrawalMethod
            };
            
            // 根据提现方式设置账户信息
            if (withdrawalMethod === 'bank') {
                withdrawalData.bank_name = bankInfo.bankName;
                withdrawalData.bank_account = bankInfo.bankAccount;
                withdrawalData.account_name = bankInfo.accountName;
            } else if (withdrawalMethod === 'alipay') {
                withdrawalData.alipay_account = bankInfo.account;
            } else if (withdrawalMethod === 'wechat') {
                withdrawalData.wechat_account = bankInfo.account;
            }
            
            db.run(`
                INSERT INTO commission_withdrawals 
                (user_id, amount, withdrawal_method, bank_name, bank_account, account_name, alipay_account, wechat_account) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                withdrawalData.user_id, withdrawalData.amount, withdrawalData.withdrawal_method,
                withdrawalData.bank_name || null, withdrawalData.bank_account || null, withdrawalData.account_name || null,
                withdrawalData.alipay_account || null, withdrawalData.wechat_account || null
            ], function(err) {
                db.close();
                if (err) {
                    return res.status(500).json({ error: '提现申请失败' });
                }
                
                res.json({
                    message: '提现申请提交成功，请等待审核',
                    data: {
                        withdrawalId: this.lastID,
                        amount: amount,
                        method: withdrawalMethod
                    }
                });
            });
        });
    } catch (error) {
        console.error('申请提现失败:', error);
        res.status(500).json({ error: '提现申请失败' });
    }
});

// 获取提现记录
router.get('/withdrawals', authenticateToken, requireAgent, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const agentId = req.user.id;
        
        const db = getDatabase();
        
        db.all(`
            SELECT cw.*, a.username as processed_by_name
            FROM commission_withdrawals cw
            LEFT JOIN admins a ON cw.processed_by = a.id
            WHERE cw.user_id = ?
            ORDER BY cw.created_at DESC
            LIMIT ? OFFSET ?
        `, [agentId, limit, offset], (err, withdrawals) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取提现记录失败' });
            }
            
            db.get('SELECT COUNT(*) as total FROM commission_withdrawals WHERE user_id = ?', 
                [agentId], (err, countResult) => {
                db.close();
                if (err) {
                    return res.status(500).json({ error: '获取提现记录总数失败' });
                }
                
                res.json({
                    message: '获取提现记录成功',
                    data: {
                        withdrawals,
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
        console.error('获取提现记录失败:', error);
        res.status(500).json({ error: '获取提现记录失败' });
    }
});

// 管理员 - 获取所有代理
router.get('/admin/agents', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;
        
        const db = getDatabase();
        
        let whereClause = 'WHERE u.user_type = "agent"';
        let params = [];
        
        if (search) {
            whereClause += ' AND (u.username LIKE ? OR u.phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        db.all(`
            SELECT u.*, 
                   COUNT(DISTINCT members.id) as member_count,
                   COUNT(DISTINCT sub_agents.id) as sub_agent_count,
                   SUM(CASE WHEN rr.status = 'paid' THEN rr.commission_amount ELSE 0 END) as total_commission
            FROM users u
            LEFT JOIN users members ON members.parent_agent_id = u.id AND members.user_type = 'member'
            LEFT JOIN users sub_agents ON sub_agents.parent_agent_id = u.id AND sub_agents.user_type = 'agent'
            LEFT JOIN referral_records rr ON rr.referrer_id = u.id
            ${whereClause}
            GROUP BY u.id
            ORDER BY u.agent_level ASC, u.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset], (err, agents) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '获取代理列表失败' });
            }
            
            db.get(`SELECT COUNT(*) as total FROM users u ${whereClause}`, params, (err, countResult) => {
                db.close();
                if (err) {
                    return res.status(500).json({ error: '获取代理总数失败' });
                }
                
                res.json({
                    message: '获取代理列表成功',
                    data: {
                        agents,
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
        console.error('获取代理列表失败:', error);
        res.status(500).json({ error: '获取代理列表失败' });
    }
});

// 管理员 - 升级用户为代理
router.post('/admin/promote/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const db = getDatabase();
        
        db.run('UPDATE users SET user_type = "agent" WHERE id = ? AND user_type = "member"', 
            [userId], function(err) {
            db.close();
            if (err) {
                return res.status(500).json({ error: '升级代理失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '用户不存在或已是代理' });
            }
            
            res.json({
                message: '用户升级为代理成功',
                data: { userId: parseInt(userId) }
            });
        });
    } catch (error) {
        console.error('升级代理失败:', error);
        res.status(500).json({ error: '升级代理失败' });
    }
});

// 管理员 - 手动创建代理账户
router.post('/admin/create', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, password, phone, parentAgentId, agentLevel } = req.body;
        
        // 验证必填字段
        if (!username || !password || !phone) {
            return res.status(400).json({
                error: '用户名、密码和手机号不能为空'
            });
        }
        
        // 验证代理级别
        const level = parseInt(agentLevel) || 1;
        if (level < 1 || level > 2) {
            return res.status(400).json({
                error: '代理级别必须是1（一级代理）或2（二级代理）'
            });
        }
        
        const bcrypt = require('bcryptjs');
        const db = getDatabase();
        
        // 检查用户名和手机号是否已存在
        db.get('SELECT id FROM users WHERE username = ? OR phone = ?', [username, phone], async (err, existingUser) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '创建代理失败' });
            }
            
            if (existingUser) {
                db.close();
                return res.status(400).json({ error: '用户名或手机号已存在' });
            }
            
            // 验证上级代理是否存在（如果提供了）
            if (parentAgentId) {
                const parentAgent = await new Promise((resolve) => {
                    db.get('SELECT id, user_type, agent_level FROM users WHERE id = ? AND user_type = "agent"', [parentAgentId], (err, row) => {
                        resolve(err ? null : row);
                    });
                });
                
                if (!parentAgent) {
                    db.close();
                    return res.status(400).json({ error: '指定的上级代理不存在或不是代理用户' });
                }
                
                // 验证代理层级关系
                if (level === 1 && parentAgent.agent_level !== 0) {
                    db.close();
                    return res.status(400).json({ error: '一级代理只能由厂家总部创建' });
                }
                
                if (level === 2 && parentAgent.agent_level !== 1) {
                    db.close();
                    return res.status(400).json({ error: '二级代理只能由一级代理创建' });
                }
            } else {
                // 没有上级代理时，只能创建一级代理
                if (level !== 1) {
                    db.close();
                    return res.status(400).json({ error: '没有上级代理时只能创建一级代理' });
                }
            }
            
            // 生成随机邀请码
            const generateReferralCode = () => {
                return Math.random().toString(36).substring(2, 8).toUpperCase();
            };
            
            // 确保生成的邀请码唯一
            let referralCode;
            let isUnique = false;
            while (!isUnique) {
                referralCode = generateReferralCode();
                const existing = await new Promise((resolve) => {
                    db.get('SELECT id FROM users WHERE referral_code = ?', [referralCode], (err, row) => {
                        resolve(err ? null : row);
                    });
                });
                if (!existing) {
                    isUnique = true;
                }
            }
            
            // 加密密码
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // 创建代理用户
            db.run(`
                INSERT INTO users (username, password, phone, user_type, agent_level, parent_agent_id, referral_code, is_active, created_at) 
                VALUES (?, ?, ?, 'agent', ?, ?, ?, 1, datetime('now'))
            `, [username, hashedPassword, phone, level, parentAgentId || null, referralCode], function(err) {
                db.close();
                if (err) {
                    console.error('创建代理用户失败:', err);
                    return res.status(500).json({ error: '创建代理失败' });
                }
                
                res.status(201).json({
                    message: '代理账户创建成功',
                    data: {
                        id: this.lastID,
                        username,
                        phone,
                        userType: 'agent',
                        agentLevel: level,
                        referralCode,
                        parentAgentId: parentAgentId || null,
                        isActive: true
                    }
                });
            });
        });
    } catch (error) {
        console.error('创建代理账户失败:', error);
        res.status(500).json({ error: '创建代理失败' });
    }
});

// 一级代理 - 创建二级代理
router.post('/create-sub-agent', authenticateToken, requireAgent, async (req, res) => {
    try {
        const { username, password, phone } = req.body;
        
        // 验证必填字段
        if (!username || !password || !phone) {
            return res.status(400).json({
                error: '用户名、密码和手机号不能为空'
            });
        }
        
        // 验证当前用户是一级代理
        if (req.user.agentLevel !== 1) {
            return res.status(403).json({
                error: '只有一级代理可以创建二级代理'
            });
        }
        
        const bcrypt = require('bcryptjs');
        const db = getDatabase();
        
        // 检查用户名和手机号是否已存在
        db.get('SELECT id FROM users WHERE username = ? OR phone = ?', [username, phone], async (err, existingUser) => {
            if (err) {
                db.close();
                return res.status(500).json({ error: '创建代理失败' });
            }
            
            if (existingUser) {
                db.close();
                return res.status(400).json({ error: '用户名或手机号已存在' });
            }
            
            // 生成随机邀请码
            const generateReferralCode = () => {
                return Math.random().toString(36).substring(2, 8).toUpperCase();
            };
            
            // 确保生成的邀请码唯一
            let referralCode;
            let isUnique = false;
            while (!isUnique) {
                referralCode = generateReferralCode();
                const existing = await new Promise((resolve) => {
                    db.get('SELECT id FROM users WHERE referral_code = ?', [referralCode], (err, row) => {
                        resolve(err ? null : row);
                    });
                });
                if (!existing) {
                    isUnique = true;
                }
            }
            
            // 加密密码
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // 创建二级代理用户
            db.run(`
                INSERT INTO users (username, password, phone, user_type, agent_level, parent_agent_id, referral_code, is_active, created_at) 
                VALUES (?, ?, ?, 'agent', 2, ?, ?, 1, datetime('now'))
            `, [username, hashedPassword, phone, req.user.id, referralCode], function(err) {
                db.close();
                if (err) {
                    console.error('创建二级代理失败:', err);
                    return res.status(500).json({ error: '创建代理失败' });
                }
                
                res.status(201).json({
                    message: '二级代理创建成功',
                    data: {
                        id: this.lastID,
                        username,
                        phone,
                        userType: 'agent',
                        agentLevel: 2,
                        referralCode,
                        parentAgentId: req.user.id,
                        isActive: true
                    }
                });
            });
        });
    } catch (error) {
        console.error('创建二级代理失败:', error);
        res.status(500).json({ error: '创建代理失败' });
    }
});

module.exports = router;
