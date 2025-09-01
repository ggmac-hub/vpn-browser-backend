const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vpn-browser-secret-key-2024';

// 登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                error: '用户名和密码不能为空'
            });
        }
        
        const db = getDatabase();
        db.get(
            'SELECT * FROM admins WHERE username = ? AND is_active = 1',
            [username],
            async (err, user) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: '数据库查询失败' });
                }
                
                if (!user) {
                    db.close();
                    return res.status(401).json({ error: '用户名或密码错误' });
                }
                
                // 验证密码
                const isValidPassword = await bcrypt.compare(password, user.password);
                if (!isValidPassword) {
                    db.close();
                    return res.status(401).json({ error: '用户名或密码错误' });
                }
                
                // 更新最后登录时间
                db.run(
                    'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                    [user.id]
                );
                
                // 生成JWT token
                const token = jwt.sign(
                    { 
                        id: user.id, 
                        username: user.username, 
                        role: user.role 
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                db.close();
                res.json({
                    message: '登录成功',
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        last_login: user.last_login
                    }
                });
            }
        );
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 获取当前用户信息
router.get('/me', authenticateToken, (req, res) => {
    const db = getDatabase();
    db.get(
        'SELECT id, username, email, role, created_at, last_login FROM admins WHERE id = ?',
        [req.user.id],
        (err, user) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: '数据库查询失败' });
            }
            
            if (!user) {
                return res.status(404).json({ error: '用户不存在' });
            }
            
            res.json({ user });
        }
    );
});

// 登出
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ message: '登出成功' });
});

module.exports = router;