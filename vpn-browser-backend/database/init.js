const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'vpn_browser.db');

// 创建数据库连接
function createConnection() {
    return new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('❌ 数据库连接失败:', err.message);
        } else {
            console.log('✅ 数据库连接成功');
        }
    });
}

// 初始化数据库表
async function initDatabase() {
    return new Promise((resolve, reject) => {
        const db = createConnection();
        
        // 启用外键约束
        db.run('PRAGMA foreign_keys = ON');
        
        // 创建管理员表
        db.run(`
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT,
                role TEXT DEFAULT 'admin',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                is_active BOOLEAN DEFAULT 1
            )
        `);
        
        // 创建技术支持信息表
        db.run(`
            CREATE TABLE IF NOT EXISTS tech_support (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                qq TEXT,
                wechat TEXT,
                telegram TEXT,
                email TEXT,
                website TEXT,
                support_hours TEXT DEFAULT '工作日 9:00-18:00 (北京时间)',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
        `);
        
        // 创建节点配置表
        db.run(`
            CREATE TABLE IF NOT EXISTS proxy_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                protocol TEXT NOT NULL,
                address TEXT NOT NULL,
                port INTEGER NOT NULL,
                config TEXT,
                region TEXT,
                country TEXT,
                city TEXT,
                is_active BOOLEAN DEFAULT 1,
                priority INTEGER DEFAULT 0,
                max_connections INTEGER DEFAULT 1000,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER,
                FOREIGN KEY (created_by) REFERENCES admins (id)
            )
        `);
        
        // 创建导航链接表
        db.run(`
            CREATE TABLE IF NOT EXISTS navigation_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                description TEXT,
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER,
                FOREIGN KEY (created_by) REFERENCES admins (id)
            )
        `);
        
        // 创建用户表 (会员和代理)
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                phone TEXT UNIQUE,
                email TEXT,
                user_type TEXT DEFAULT 'member', -- member, agent
                agent_level INTEGER DEFAULT 0, -- 0: 普通用户, 1: 一级代理, 2: 二级代理
                parent_agent_id INTEGER,
                referral_code TEXT UNIQUE,
                device_id TEXT,
                device_info TEXT,
                last_login_device TEXT,
                last_login_time DATETIME,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_agent_id) REFERENCES users (id)
            )
        `);
        
        // 创建会员套餐表
        db.run(`
            CREATE TABLE IF NOT EXISTS membership_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                duration_days INTEGER NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                original_price DECIMAL(10,2),
                discount_rate DECIMAL(5,2) DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 创建用户会员记录表
        db.run(`
            CREATE TABLE IF NOT EXISTS user_memberships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan_id INTEGER NOT NULL,
                agent_id INTEGER,
                start_date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                payment_amount DECIMAL(10,2) NOT NULL,
                payment_method TEXT,
                payment_status TEXT DEFAULT 'pending', -- pending, paid, failed, refunded
                order_no TEXT UNIQUE,
                device_binding_info TEXT,
                status TEXT DEFAULT 'active', -- active, expired, cancelled
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (plan_id) REFERENCES membership_plans (id),
                FOREIGN KEY (agent_id) REFERENCES users (id)
            )
        `);
        
        // 创建代理层级关系表
        db.run(`
            CREATE TABLE IF NOT EXISTS agent_hierarchy (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                parent_agent_id INTEGER,
                level INTEGER NOT NULL, -- 1, 2
                commission_rate_l1 DECIMAL(5,2) DEFAULT 40.00,
                commission_rate_l2 DECIMAL(5,2) DEFAULT 10.00,
                status TEXT DEFAULT 'active', -- active, suspended
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (agent_id) REFERENCES users (id),
                FOREIGN KEY (parent_agent_id) REFERENCES users (id)
            )
        `);
        
        // 创建推广记录表
        db.run(`
            CREATE TABLE IF NOT EXISTS referral_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                referrer_id INTEGER NOT NULL,
                referee_id INTEGER NOT NULL,
                membership_id INTEGER NOT NULL,
                level INTEGER NOT NULL, -- 1, 2
                order_amount DECIMAL(10,2) NOT NULL,
                commission_rate DECIMAL(5,2) NOT NULL,
                commission_amount DECIMAL(10,2) NOT NULL,
                status TEXT DEFAULT 'pending', -- pending, paid, cancelled
                paid_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (referrer_id) REFERENCES users (id),
                FOREIGN KEY (referee_id) REFERENCES users (id),
                FOREIGN KEY (membership_id) REFERENCES user_memberships (id)
            )
        `);
        
        // 创建佣金提现记录表
        db.run(`
            CREATE TABLE IF NOT EXISTS commission_withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                bank_name TEXT,
                bank_account TEXT,
                account_name TEXT,
                alipay_account TEXT,
                wechat_account TEXT,
                withdrawal_method TEXT NOT NULL, -- bank, alipay, wechat
                status TEXT DEFAULT 'pending', -- pending, approved, rejected, paid
                admin_note TEXT,
                processed_by INTEGER,
                processed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (processed_by) REFERENCES admins (id)
            )
        `);
        
        // 创建设备会话管理表
        db.run(`
            CREATE TABLE IF NOT EXISTS device_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                device_id TEXT NOT NULL,
                device_info TEXT,
                login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_active_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                location TEXT,
                status TEXT DEFAULT 'active', -- active, kicked, expired
                kicked_by INTEGER,
                kicked_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (kicked_by) REFERENCES admins (id)
            )
        `);
        
        // 创建用户使用统计表
        db.run(`
            CREATE TABLE IF NOT EXISTS user_usage_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date DATE NOT NULL,
                traffic_used BIGINT DEFAULT 0,
                connection_count INTEGER DEFAULT 0,
                online_duration INTEGER DEFAULT 0, -- 秒
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(user_id, date)
            )
        `);
        
        // 创建操作日志表
        db.run(`
            CREATE TABLE IF NOT EXISTS operation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER,
                user_id INTEGER,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id INTEGER,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admins (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error('❌ 创建表失败:', err);
                reject(err);
                return;
            }
            
            // 插入默认数据
            insertDefaultData(db, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
                db.close();
            });
        });
    });
}

// 插入默认数据
async function insertDefaultData(db, callback) {
    try {
        // 检查是否已有管理员
        const adminCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM admins', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        if (adminCount === 0) {
            // 创建默认管理员
            const bcrypt = require('bcryptjs');
            const defaultPassword = await bcrypt.hash('admin123', 10);
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO admins (username, password, email, role) 
                    VALUES (?, ?, ?, ?)
                `, ['admin', defaultPassword, 'admin@vpnbrowser.com', 'super_admin'], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            console.log('✅ 默认管理员账号创建成功');
            console.log('📧 用户名: admin');
            console.log('🔑 密码: admin123');
            console.log('⚠️  请登录后立即修改默认密码！');
        }
        
        // 检查技术支持信息
        db.get('SELECT COUNT(*) as count FROM tech_support', (err, row) => {
            if (err) {
                callback(err);
                return;
            }
            
            if (row.count === 0) {
                // 插入默认技术支持信息
                db.run(`
                    INSERT INTO tech_support (qq, wechat, support_hours) 
                    VALUES (?, ?, ?)
                `, ['888888888', 'vpn_support_2024', '工作日 9:00-18:00 (北京时间)']);
                
                console.log('✅ 默认技术支持信息创建成功');
            }
            
            // 检查会员套餐
            db.get('SELECT COUNT(*) as count FROM membership_plans', (err, row) => {
                if (err) {
                    callback(err);
                    return;
                }
                
                if (row.count === 0) {
                    // 插入默认套餐
                    const plans = [
                        ['月卡', 30, 19.90, 19.90, 0, 1],
                        ['季卡', 90, 53.70, 59.70, 10, 2],
                        ['半年卡', 180, 101.50, 119.40, 15, 3],
                        ['年卡', 365, 191.20, 238.80, 20, 4]
                    ];
                    
                    plans.forEach(plan => {
                        db.run(`
                            INSERT INTO membership_plans (name, duration_days, price, original_price, discount_rate, sort_order) 
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, plan);
                    });
                    
                    console.log('✅ 默认会员套餐创建成功');
                }
                
                callback(null);
            });
        });
    } catch (error) {
        callback(error);
    }
}

// 获取数据库连接
function getDatabase() {
    return createConnection();
}

module.exports = {
    initDatabase,
    getDatabase,
    DB_PATH
};