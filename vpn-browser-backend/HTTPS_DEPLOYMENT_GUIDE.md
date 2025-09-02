# HTTPS部署指南

## 🔐 SSL证书获取方案

### 方案1: Let's Encrypt (免费，推荐)
```bash
# 安装Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 自动续期
sudo crontab -e
# 添加以下行：
0 12 * * * /usr/bin/certbot renew --quiet
```

### 方案2: 阿里云SSL证书
1. 登录阿里云控制台
2. 搜索"SSL证书"
3. 申请免费证书（DV SSL）
4. 下载Nginx格式证书

### 方案3: 腾讯云SSL证书
1. 登录腾讯云控制台
2. 搜索"SSL证书"
3. 申请免费证书
4. 下载Nginx格式证书

## 🚀 部署步骤

### 1. 域名解析
```
A记录: yourdomain.com -> 158.247.205.19
A记录: www.yourdomain.com -> 158.247.205.19
```

### 2. 安装Nginx
```bash
sudo apt update
sudo apt install nginx
```

### 3. 配置Nginx
```bash
# 复制配置文件
sudo cp nginx.conf /etc/nginx/sites-available/vpn-backend
sudo ln -s /etc/nginx/sites-available/vpn-backend /etc/nginx/sites-enabled/

# 删除默认配置
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

### 4. 更新应用配置
```bash
# 修改server.js中的域名
sed -i 's/yourdomain.com/您的实际域名/g' server.js

# 重新部署
git add .
git commit -m "更新域名配置"
git push origin main

# 服务器更新
ssh root@158.247.205.19
cd /opt/vpn-browser-backend/vpn-browser-backend
git pull origin main
docker-compose restart
```

### 5. 防火墙配置
```bash
# 开放HTTP和HTTPS端口
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 🔧 配置文件说明

### server.js 安全策略
- ✅ 强制HTTPS (HSTS)
- ✅ 内容安全策略 (CSP)
- ✅ 跨域资源共享 (CORS)
- ✅ 升级不安全请求

### nginx.conf 特性
- ✅ HTTP自动重定向HTTPS
- ✅ SSL/TLS安全配置
- ✅ 反向代理到Node.js
- ✅ 静态文件缓存
- ✅ Gzip压缩

## 📋 部署后验证

### 1. SSL证书检查
```bash
curl -I https://yourdomain.com
```

### 2. 安全头检查
```bash
curl -I https://yourdomain.com | grep -E "(Strict-Transport|Content-Security)"
```

### 3. 应用功能测试
- 访问 https://yourdomain.com
- 登录管理后台
- 测试API接口

## 🚨 注意事项

1. **域名替换**: 将所有 `yourdomain.com` 替换为您的实际域名
2. **证书路径**: 更新nginx.conf中的证书路径
3. **DNS生效**: 域名解析可能需要几分钟到几小时生效
4. **防火墙**: 确保服务器防火墙开放80和443端口
5. **备份**: 部署前备份现有配置

## 📞 技术支持

如果遇到问题，请检查：
- 域名解析是否正确
- SSL证书是否有效
- Nginx配置语法是否正确
- 服务器防火墙设置
- Docker容器运行状态
