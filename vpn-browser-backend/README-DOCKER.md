# VPN浏览器后台管理系统 - Docker部署指南

## 🚀 快速部署

### 1. 本地开发环境（Mac）

#### 初始化Git仓库并推送到GitHub
```bash
# 在项目根目录执行
git init
git add .
git commit -m "Initial commit: VPN Browser Backend Management System"

# 在GitHub创建仓库后，替换YOUR_USERNAME为你的GitHub用户名
git remote add origin https://github.com/ggmac-hub/vpn-browser-backend.git
git branch -M main
git push -u origin main
```

#### 本地Docker测试
```bash
# 构建镜像
docker build -t vpn-browser-backend .

# 运行容器
docker run -d -p 3000:3000 --name vpn-backend vpn-browser-backend

# 或使用docker-compose
docker-compose up -d
```

### 2. 服务器部署（Ubuntu/Debian）

#### 一键部署脚本
```bash
# 下载并运行部署脚本
curl -fsSL https://raw.githubusercontent.com/ggmac-hub/vpn-browser-backend/main/deploy.sh -o deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

#### 手动部署步骤
```bash
# 1. 安装Docker和Docker Compose
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git

# 2. 克隆项目
git clone https://github.com/ggmac-hub/vpn-browser-backend.git
cd vpn-browser-backend

# 3. 启动服务
docker-compose up -d
```

## 🔄 开发流程

### 本地修改 → 服务器更新
```bash
# 1. 本地修改代码后
git add .
git commit -m "修复bug: 描述修改内容"
git push origin main

# 2. 服务器更新（SSH到服务器执行）
cd /opt/vpn-browser-backend
git pull origin main
docker-compose down
docker-compose build
docker-compose up -d
```

### 自动化更新脚本
在服务器上创建 `update.sh`：
```bash
#!/bin/bash
cd /opt/vpn-browser-backend
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
echo "✅ 更新完成"
```

## 📁 项目结构
```
vpn-browser-backend/
├── Dockerfile              # Docker镜像构建文件
├── docker-compose.yml      # Docker Compose配置
├── deploy.sh               # 一键部署脚本
├── .dockerignore           # Docker忽略文件
├── server.js               # 后端服务器
├── frontend/               # 前端代码
├── database/               # 数据库文件（持久化）
└── logs/                   # 日志文件（持久化）
```

## 🛠️ 常用命令

### Docker管理
```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 完全重建
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 数据备份
```bash
# 备份数据库
docker cp vpn-browser-backend:/app/database ./backup-$(date +%Y%m%d)

# 恢复数据库
docker cp ./backup-20241201/database vpn-browser-backend:/app/
```

## 🔧 配置说明

### 环境变量
在 `docker-compose.yml` 中可以修改：
- `PORT`: 服务端口（默认3000）
- `JWT_SECRET`: JWT密钥
- `NODE_ENV`: 运行环境

### 端口映射
- 容器内端口：3000
- 主机端口：3000（可在docker-compose.yml中修改）

### 数据持久化
- 数据库文件：`./database` → `/app/database`
- 日志文件：`./logs` → `/app/logs`

## 🚨 故障排查

### 常见问题
1. **端口被占用**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 PID
   ```

2. **权限问题**
   ```bash
   sudo chown -R $USER:$USER /opt/vpn-browser-backend
   ```

3. **Docker空间不足**
   ```bash
   docker system prune -a
   ```

### 查看详细日志
```bash
# 应用日志
docker-compose logs vpn-browser-backend

# 系统日志
journalctl -u docker
```

## 🔐 安全建议

1. **修改默认密码**：部署后立即修改admin密码
2. **防火墙配置**：只开放必要端口
3. **SSL证书**：使用Nginx反向代理配置HTTPS
4. **定期备份**：设置自动备份脚本

## 📞 技术支持

- 项目地址：https://github.com/ggmac-hub/vpn-browser-backend
- 问题反馈：GitHub Issues
- 部署文档：README-DOCKER.md

---

**注意**：GitHub用户名已更新为 `ggmac-hub`，可以直接使用！
