# VPN浏览器后端管理系统

## 📖 项目简介

VPN浏览器后端管理系统是一个完整的Node.js + Vue.js全栈应用，为VPN浏览器客户端提供后端API服务和管理界面。

### 🎯 主要功能

- **技术支持信息管理** - 动态配置客户端技术支持联系方式
- **节点配置管理** - 管理代理节点，支持多种协议（VMess、VLess、Trojan、Shadowsocks）
- **统计分析** - 实时监控节点状态、流量统计、性能分析
- **管理后台** - 现代化的Web管理界面
- **操作日志** - 完整的操作审计日志
- **权限管理** - 基于角色的访问控制

### 🏗️ 技术架构

**后端技术栈:**
- Node.js + Express.js
- SQLite3 数据库
- JWT 认证
- RESTful API

**前端技术栈:**
- Vue 3 + Composition API
- Element Plus UI组件库
- Vue Router 4
- ECharts 图表库
- Vite 构建工具

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
# 安装后端和前端依赖
npm run install:all

# 或者分别安装
npm install                    # 后端依赖
cd frontend && npm install     # 前端依赖
```

### 开发环境启动

```bash
# 启动后端服务 (端口: 3000)
npm run dev

# 启动前端开发服务器 (端口: 8080)
cd frontend
npm run dev
```

### 生产环境部署

```bash
# 构建前端
npm run build

# 启动生产服务器
npm start
```

## 📁 项目结构

```
vpn-browser-backend/
├── server.js                 # 服务器入口文件
├── package.json              # 后端依赖配置
├── database/                 # 数据库相关
│   └── init.js              # 数据库初始化
├── models/                   # 数据模型
│   ├── TechSupport.js       # 技术支持模型
│   └── ProxyNode.js         # 代理节点模型
├── routes/                   # API路由
│   ├── auth.js              # 认证路由
│   ├── techSupport.js       # 技术支持API
│   ├── nodes.js             # 节点管理API
│   ├── stats.js             # 统计API
│   └── dashboard.js         # 仪表板API
├── middleware/               # 中间件
│   └── auth.js              # 认证中间件
├── utils/                    # 工具函数
│   └── nodeParser.js        # 节点URL解析
└── frontend/                 # 前端项目
    ├── package.json         # 前端依赖配置
    ├── vite.config.js       # Vite配置
    ├── index.html           # 入口HTML
    └── src/                 # 源代码
        ├── main.js          # 应用入口
        ├── App.vue          # 根组件
        ├── router/          # 路由配置
        ├── views/           # 页面组件
        ├── components/      # 公共组件
        ├── api/             # API接口
        ├── utils/           # 工具函数
        └── styles/          # 样式文件
```

## 🔧 API接口文档

### 认证接口

- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/change-password` - 修改密码
- `POST /api/auth/logout` - 退出登录

### 技术支持接口

- `GET /api/support` - 获取技术支持信息（公开）
- `PUT /api/support` - 更新技术支持信息（需认证）
- `GET /api/support/history` - 获取历史记录（需认证）

### 节点管理接口

- `GET /api/nodes` - 获取节点列表（公开）
- `GET /api/nodes/admin` - 获取节点列表（管理员）
- `POST /api/nodes` - 创建节点
- `PUT /api/nodes/:id` - 更新节点
- `DELETE /api/nodes/:id` - 删除节点
- `POST /api/nodes/import-url` - 通过URL导入节点
- `POST /api/nodes/batch-import` - 批量导入节点

### 统计分析接口

- `GET /api/stats/overview` - 获取统计概览
- `GET /api/stats/realtime` - 获取实时统计
- `GET /api/stats/history` - 获取历史统计
- `GET /api/stats/traffic-trend` - 获取流量趋势

### 仪表板接口

- `GET /api/dashboard` - 获取仪表板数据
- `GET /api/dashboard/system-status` - 获取系统状态
- `GET /api/dashboard/logs` - 获取操作日志

## 🔐 默认账号

**管理员账号:**
- 用户名: `admin`
- 密码: `admin123`

⚠️ **重要提示:** 首次登录后请立即修改默认密码！

## 🎨 管理后台功能

### 仪表板
- 系统概览统计
- 实时流量监控
- 节点状态分布
- 操作日志记录

### 节点管理
- 节点列表查看
- 添加/编辑/删除节点
- 批量导入节点
- 支持多种协议解析

### 技术支持
- 配置联系方式
- 实时更新客户端信息
- 历史记录查看

### 统计分析
- 流量趋势图表
- 节点性能排行
- 地区分布统计
- 实时监控数据

### 系统设置
- 用户管理
- 权限配置
- 系统参数设置

## 🔄 与客户端集成

客户端通过以下API获取配置信息：

```javascript
// 获取技术支持信息
GET /api/support

// 获取节点列表
GET /api/nodes?active=1

// 上报统计数据
POST /api/stats/report
```

## 🛠️ 开发指南

### 添加新的API接口

1. 在 `routes/` 目录下创建路由文件
2. 在 `models/` 目录下创建数据模型
3. 在 `server.js` 中注册路由
4. 更新前端API调用

### 添加新的页面

1. 在 `frontend/src/views/` 创建Vue组件
2. 在 `frontend/src/router/index.js` 添加路由
3. 在布局组件中添加菜单项

### 数据库迁移

数据库结构变更时，需要更新 `database/init.js` 中的表结构定义。

## 📝 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 完整的后端API系统
- 现代化的管理后台界面
- 支持多种代理协议
- 实时统计和监控功能

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 技术支持

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件至开发团队
- 查看项目文档

---

**VPN浏览器管理系统** - 让代理管理更简单、更高效！
