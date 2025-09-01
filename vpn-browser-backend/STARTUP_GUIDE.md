# VPN浏览器后端启动指南

## 📋 概述

本项目提供了多种启动方式，适合不同的使用场景和操作系统。

## 🚀 启动方式

### 1. 完整启动脚本 (推荐)

**Linux/macOS:**
```bash
./start.sh
```

**Windows:**
```cmd
start.bat
```

**功能特点:**
- ✅ 完整的环境检查
- ✅ 自动安装依赖
- ✅ 前端构建检查
- ✅ 数据库初始化
- ✅ 端口占用检查
- ✅ 详细的启动信息
- ✅ 错误处理和重试机制

### 2. 快速启动脚本

**Linux/macOS:**
```bash
./quick-start.sh
```

**功能特点:**
- ⚡ 快速启动，适合开发环境
- ✅ 基本依赖检查
- ✅ 自动构建前端
- ✅ 简洁的输出信息

### 3. 传统启动方式

```bash
# 安装依赖
npm install

# 构建前端
cd frontend && npm install && npm run build && cd ..

# 启动服务器
npm start
```

## 🔧 配置选项

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | 3000 | 服务器端口 |
| `NODE_ENV` | development | 运行环境 |

### 启动参数

**完整启动脚本支持以下参数:**

```bash
./start.sh -h                    # 显示帮助信息
./start.sh -p 8080              # 指定端口
./start.sh -e production        # 指定环境
```

## 🌐 访问地址

启动成功后，可以通过以下地址访问：

- **管理后台:** http://localhost:3000
- **API接口:** http://localhost:3000/api
- **健康检查:** http://localhost:3000/api/health

## 👤 默认账号

**管理员账号:**
- 用户名: `admin`
- 密码: `admin123`

⚠️ **重要:** 请在首次登录后立即修改默认密码！

## 📁 项目结构

```
vpn-browser-backend/
├── start.sh              # Linux/macOS 完整启动脚本
├── start.bat             # Windows 启动脚本
├── quick-start.sh        # 快速启动脚本
├── server.js             # 主服务器文件
├── package.json          # 项目配置
├── database/             # 数据库相关
│   ├── init.js          # 数据库初始化
│   └── vpn_browser.db   # SQLite 数据库文件
├── frontend/             # 前端项目
│   └── dist/            # 构建后的前端文件
├── routes/               # API 路由
├── models/               # 数据模型
└── middleware/           # 中间件
```

## 🛠️ 开发模式

开发模式下会自动启用以下功能：

- 🔄 文件变化自动重启 (使用 nodemon)
- 📝 详细的错误信息
- 🔍 请求日志记录
- 🌐 CORS 允许本地访问

## 🔒 生产环境

生产环境部署建议：

1. 设置环境变量 `NODE_ENV=production`
2. 使用 PM2 或其他进程管理器
3. 配置反向代理 (Nginx)
4. 启用 HTTPS
5. 配置防火墙规则

## ❗ 常见问题

### 1. 端口被占用
```bash
# 查找占用端口的进程
lsof -i :3000

# 终止进程
kill -9 <PID>
```

### 2. 依赖安装失败
```bash
# 清除缓存重新安装
rm -rf node_modules package-lock.json
npm install
```

### 3. 前端构建失败
```bash
# 重新构建前端
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

### 4. 数据库问题
```bash
# 删除数据库文件重新初始化
rm database/vpn_browser.db
# 重新启动服务器会自动创建
```

## 📞 技术支持

如果遇到问题，请检查：

1. Node.js 版本 >= 16.0.0
2. npm 版本 >= 8.0.0
3. 端口 3000 未被占用
4. 磁盘空间充足
5. 网络连接正常

## 📝 更新日志

### v1.0.0
- ✨ 初始版本
- ✅ 完整的启动脚本
- ✅ 跨平台支持
- ✅ 自动化部署流程
