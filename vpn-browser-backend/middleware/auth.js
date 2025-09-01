const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'vpn-browser-secret-key-2024';

// JWT认证中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ 
            error: '访问被拒绝，需要认证token' 
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                error: 'Token无效或已过期' 
            });
        }
        
        req.user = user;
        next();
    });
}

// 角色权限检查中间件
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: '未认证用户' 
            });
        }
        
        // 支持管理员角色检查
        if (req.user.role && !roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: '权限不足' 
            });
        }
        
        // 支持用户类型检查
        if (req.user.userType && !roles.includes(req.user.userType)) {
            return res.status(403).json({ 
                error: '权限不足' 
            });
        }
        
        next();
    };
}

// 管理员权限检查
function requireAdmin(req, res, next) {
    return requireRole(['admin', 'super_admin'])(req, res, next);
}

// 会员权限检查
function requireMember(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ 
            error: '未认证用户' 
        });
    }
    
    // 管理员和会员都可以访问
    if (req.user.role || req.user.userType === 'member' || req.user.userType === 'agent') {
        return next();
    }
    
    return res.status(403).json({ 
        error: '需要会员权限' 
    });
}

module.exports = {
    authenticateToken,
    requireRole,
    requireAdmin,
    requireMember
};