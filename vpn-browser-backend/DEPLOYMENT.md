# 🚀 VPN浏览器后端管理系统部署指南

## 📋 部署清单

### 服务器要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **CPU**: 1核心以上
- **内存**: 1GB以上
- **存储**: 10GB以上可用空间
- **网络**: 公网IP，开放端口3000（或自定义端口）

### 软件依赖

- Node.js 16.0.0+
- npm 8.0.0+
- PM2（进程管理器）
- Nginx（可选，用于反向代理）

## 🔧 服务器环境准备

### 1. 安装Node.js

```bash
# 使用NodeSource仓库安装Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 安装PM2

```bash
# 全局安装PM2
sudo npm install -g pm2

# 验证安装
pm2 --version
```

### 3. 创建应用用户（推荐）

```bash
# 创建专用用户
sudo adduser vpnbrowser
sudo usermod -aG sudo vpnbrowser

# 切换到应用用户
su - vpnbrowser
```

## 📦 应用部署

### 1. 下载项目代码

```bash
# 克隆项目（如果使用Git）
git clone <your-repository-url> vpn-browser-backend
cd vpn-browser-backend

# 或者上传项目文件到服务器
# scp -r vpn-browser-backend/ user@server:/home/vpnbrowser/
```

### 2. 安装依赖

```bash
# 安装后端依赖
npm install --production

# 安装前端依赖并构建
cd frontend
npm install
npm run build
cd ..
```

### 3. 配置环境变量

```bash
# 创建环境配置文件
cat > .env << EOF
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DB_PATH=./database/vpn_browser.db
EOF
```

### 4. 初始化数据库

```bash
# 启动应用进行数据库初始化
node server.js

# 看到数据库初始化成功信息后，按Ctrl+C停止
```

## 🔄 使用PM2部署

### 1. 创建PM2配置文件

```bash
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'vpn-browser-backend',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF
```

### 2. 创建日志目录

```bash
mkdir -p logs
```

### 3. 启动应用

```bash
# 使用PM2启动应用
pm2 start ecosystem.config.js

# 查看应用状态
pm2 status

# 查看日志
pm2 logs vpn-browser-backend

# 设置开机自启
pm2 startup
pm2 save
```

## 🌐 Nginx反向代理配置（推荐）

### 1. 安装Nginx

```bash
sudo apt update
sudo apt install nginx
```

### 2. 创建Nginx配置

```bash
sudo cat > /etc/nginx/sites-available/vpn-browser-backend << EOF
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名
    
    # 静态文件服务
    location / {
        root /home/vpnbrowser/vpn-browser-backend/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF
```

### 3. 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/vpn-browser-backend /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 🔒 SSL证书配置（推荐）

### 使用Let's Encrypt免费证书

```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 设置自动续期
sudo crontab -e
# 添加以下行：
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔥 防火墙配置

```bash
# 使用UFW配置防火墙
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 查看状态
sudo ufw status
```

## 📊 监控和维护

### 1. 系统监控

```bash
# 查看应用状态
pm2 status
pm2 monit

# 查看系统资源
htop
df -h
free -h
```

### 2. 日志管理

```bash
# 查看应用日志
pm2 logs vpn-browser-backend

# 清理日志
pm2 flush

# 设置日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 3. 数据库备份

```bash
# 创建备份脚本
cat > backup.sh << EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/vpnbrowser/backups"
DB_PATH="/home/vpnbrowser/vpn-browser-backend/database/vpn_browser.db"

mkdir -p \$BACKUP_DIR
cp \$DB_PATH \$BACKUP_DIR/vpn_browser_\$DATE.db

# 保留最近30天的备份
find \$BACKUP_DIR -name "vpn_browser_*.db" -mtime +30 -delete

echo "数据库备份完成: vpn_browser_\$DATE.db"
EOF

chmod +x backup.sh

# 设置定时备份
crontab -e
# 添加以下行（每天凌晨2点备份）：
# 0 2 * * * /home/vpnbrowser/vpn-browser-backend/backup.sh
```

## 🔄 应用更新

### 1. 创建更新脚本

```bash
cat > update.sh << EOF
#!/bin/bash
echo "开始更新应用..."

# 停止应用
pm2 stop vpn-browser-backend

# 备份当前版本
cp -r . ../vpn-browser-backend-backup-\$(date +%Y%m%d_%H%M%S)

# 拉取最新代码（如果使用Git）
git pull origin main

# 更新依赖
npm install --production

# 构建前端
cd frontend
npm install
npm run build
cd ..

# 重启应用
pm2 restart vpn-browser-backend

echo "应用更新完成！"
EOF

chmod +x update.sh
```

### 2. 执行更新

```bash
./update.sh
```

## 🚨 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   sudo netstat -tlnp | grep :3000
   # 或使用lsof
   sudo lsof -i :3000
   ```

2. **权限问题**
   ```bash
   # 修复文件权限
   sudo chown -R vpnbrowser:vpnbrowser /home/vpnbrowser/vpn-browser-backend
   chmod -R 755 /home/vpnbrowser/vpn-browser-backend
   ```

3. **内存不足**
   ```bash
   # 查看内存使用
   free -h
   # 重启应用释放内存
   pm2 restart vpn-browser-backend
   ```

4. **数据库锁定**
   ```bash
   # 检查数据库文件权限
   ls -la database/
   # 重启应用
   pm2 restart vpn-browser-backend
   ```

### 日志分析

```bash
# 查看错误日志
pm2 logs vpn-browser-backend --err

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log

# 查看系统日志
sudo journalctl -u nginx -f
```

## 📈 性能优化

### 1. Node.js优化

```bash
# 在ecosystem.config.js中添加优化参数
env: {
  NODE_ENV: 'production',
  PORT: 3000,
  NODE_OPTIONS: '--max-old-space-size=1024'
}
```

### 2. 数据库优化

```bash
# 定期清理过期数据（在管理后台执行）
# 或创建清理脚本
cat > cleanup.sh << EOF
#!/bin/bash
node -e "
const { getDatabase } = require('./database/init');
const db = getDatabase();
db.run('DELETE FROM realtime_stats WHERE timestamp < datetime(\"now\", \"-7 days\")');
db.run('DELETE FROM operation_logs WHERE created_at < datetime(\"now\", \"-90 days\")');
db.close();
console.log('数据清理完成');
"
EOF
```

## 🔐 安全加固

### 1. 系统安全

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 禁用root登录
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# 安装fail2ban
sudo apt install fail2ban
```

### 2. 应用安全

- 定期更新JWT密钥
- 使用强密码策略
- 启用HTTPS
- 定期备份数据
- 监控异常访问

---

**部署完成后，访问 `http://your-domain.com` 即可使用管理后台！**

默认管理员账号：`admin` / `admin123`（请立即修改密码）
