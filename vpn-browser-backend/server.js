const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 导入路由
const authRoutes = require('./routes/auth');
const techSupportRoutes = require('./routes/techSupport');
const nodeRoutes = require('./routes/nodes');
const statsRoutes = require('./routes/stats');
const dashboardRoutes = require('./routes/dashboard');
const membershipRoutes = require('./routes/membership');
const agentRoutes = require('./routes/agent');
const deviceRoutes = require('./routes/device');
const paymentRoutes = require('./routes/payment');

// 导入数据库初始化
const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件 - 强制HTTPS安全策略
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
            fontSrc: ["'self'", "https:", "data:"],
            upgradeInsecureRequests: [], // 强制升级到HTTPS
        },
    },
    hsts: {
        maxAge: 31536000, // 1年
        includeSubDomains: true,
        preload: true
    },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    originAgentCluster: true,
}));

// CORS配置 - 520xuexi.sbs域名
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://520xuexi.sbs', 'https://www.520xuexi.sbs'] 
        : ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000'],
    credentials: true
}));

// 请求限制 - 为管理后台调整更宽松的限制
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 500, // 每个IP每分钟最多500个请求（管理后台需要更多请求）
    message: {
        error: '请求过于频繁，请稍后再试'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 登录相关的严格限制
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 10, // 登录相关操作限制更严格
    message: {
        error: '登录尝试过于频繁，请稍后再试'
    }
});

// 用户端API的中等限制
const userLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 100, // 用户端限制相对严格一些
    message: {
        error: '请求过于频繁，请稍后再试'
    }
});

// 应用限制
app.use('/api/auth/', authLimiter); // 登录最严格
app.use('/api/user/', userLimiter); // 用户端中等
app.use('/api/', generalLimiter); // 其他API最宽松

// 日志中间件
app.use(morgan('combined'));

// 解析中间件
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/support', techSupportRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/navigation', require('./routes/navigation'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/pricing', require('./routes/pricing'));
app.use('/api/operation-logs', require('./routes/operationLogs').router);

// 为安卓客户端提供的独立API端点
app.get('/api/config', async (req, res) => {
    try {
        const config = {
            version: "1.0.0",
            updateUrl: "",
            announcement: "欢迎使用VPN浏览器！请遵守当地法律法规。",
            maintenanceMode: false,
            features: {
                autoConnect: true,
                smartRouting: true,
                adBlock: false,
                speedTest: true
            },
            lastUpdated: Date.now()
        };
        res.json(config);
    } catch (error) {
        console.error('获取应用配置失败:', error);
        res.status(500).json({ error: '获取应用配置失败' });
    }
});

app.get('/api/ping', async (req, res) => {
    try {
        res.json({
            status: "ok",
            timestamp: Date.now(),
            server: "VPN Browser Backend",
            version: "1.0.0"
        });
    } catch (error) {
        console.error('连接测试失败:', error);
        res.status(500).json({ error: '连接测试失败' });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require('./package.json').version
    });
});

// 前端路由 - 所有非API请求都返回index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        error: '接口不存在',
        path: req.path
    });
});

// 初始化数据库并启动服务器
async function startServer() {
    try {
        await initDatabase();
        console.log('✅ 数据库初始化完成');
        
        app.listen(PORT, () => {
            console.log(`🚀 VPN浏览器后端管理系统启动成功`);
            console.log(`📡 服务器运行在: http://localhost:${PORT}`);
            console.log(`🎯 API接口地址: http://localhost:${PORT}/api`);
            console.log(`📊 管理后台: http://localhost:${PORT}`);
            console.log(`⏰ 启动时间: ${new Date().toLocaleString()}`);
        });
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('🛑 收到SIGTERM信号，正在关闭服务器...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 收到SIGINT信号，正在关闭服务器...');
    process.exit(0);
});

startServer();
