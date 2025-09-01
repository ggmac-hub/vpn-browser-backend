# 操作日志系统完整指南

## 🎯 系统概述

操作日志系统是一个完整的管理员操作追踪和审计系统，记录所有重要的管理操作，确保系统安全性和可追溯性。

## 📊 功能特性

### 🔍 全面记录
- **用户管理**：密码修改、用户状态变更
- **会员管理**：会员天数调整、会员状态变更
- **技术支持**：联系信息修改
- **系统管理**：配置变更、系统操作

### 📝 详细信息
- **操作者信息**：管理员ID、用户名
- **操作对象**：目标类型、目标ID、目标名称
- **操作详情**：动作类型、操作描述、操作原因
- **数据变更**：修改前后的完整数据对比
- **环境信息**：IP地址、用户代理、操作时间

### 🔎 强大查询
- **多维度筛选**：按操作类型、动作类型、管理员、日期范围
- **实时统计**：今日操作数、活跃管理员、操作趋势
- **详情查看**：完整的操作详情和数据变更对比

## 🛠️ 技术实现

### 数据库结构
```sql
CREATE TABLE operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,              -- 操作管理员ID
    admin_username TEXT NOT NULL,           -- 操作管理员用户名
    target_type TEXT NOT NULL,              -- 操作类型：user, membership, tech_support, system
    target_id INTEGER,                      -- 操作对象ID
    target_name TEXT,                       -- 操作对象名称
    action_type TEXT NOT NULL,              -- 动作类型：create, update, delete, password_change, membership_adjust
    action_description TEXT NOT NULL,       -- 操作描述
    old_values TEXT,                        -- 修改前的值（JSON格式）
    new_values TEXT,                        -- 修改后的值（JSON格式）
    reason TEXT,                           -- 操作原因
    ip_address TEXT,                       -- IP地址
    user_agent TEXT,                       -- 用户代理
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### API接口

#### 1. 获取操作日志列表
```
GET /api/operation-logs
```

**查询参数：**
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）
- `targetType`: 操作类型筛选
- `actionType`: 动作类型筛选
- `adminUsername`: 管理员用户名筛选
- `startDate`: 开始日期
- `endDate`: 结束日期

**响应示例：**
```json
{
  "message": "获取操作日志成功",
  "data": {
    "logs": [
      {
        "id": 5,
        "admin_username": "admin",
        "target_type": "tech_support",
        "action_type": "update",
        "action_description": "更新技术支持联系信息",
        "old_values": {
          "qq": "888888888",
          "wechat": "vpn_support_2024"
        },
        "new_values": {
          "qq": "123456789",
          "wechat": "test_wechat_2024"
        },
        "reason": "管理员更新",
        "created_at": "2025-09-01T09:30:19.022Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

#### 2. 获取统计信息
```
GET /api/operation-logs/stats
```

**响应示例：**
```json
{
  "message": "获取统计信息成功",
  "data": {
    "todayCount": 3,
    "activeAdmins": [
      {
        "admin_username": "admin",
        "operation_count": 2
      }
    ],
    "dailyStats": [...]
  }
}
```

### 日志记录函数

```javascript
const { logOperation } = require('./routes/operationLogs');

// 使用示例
logOperation(
    adminId,           // 管理员ID
    adminUsername,     // 管理员用户名
    'user',           // 操作类型
    userId,           // 目标ID
    username,         // 目标名称
    'password_change', // 动作类型
    '管理员强制修改用户密码', // 操作描述
    null,             // 修改前的值
    { action: '密码已修改' }, // 修改后的值
    '管理员操作',      // 操作原因
    req.ip,           // IP地址
    req.get('User-Agent') // 用户代理
);
```

## 📱 前端界面

### 主要功能
1. **统计卡片**：显示今日操作、总记录数、活跃管理员等统计信息
2. **搜索筛选**：支持多维度筛选和日期范围查询
3. **操作列表**：表格形式展示所有操作记录
4. **详情查看**：弹窗显示完整的操作详情和数据变更对比

### 界面特色
- **直观的标签**：不同颜色标签区分操作类型和动作类型
- **数据对比**：JSON格式展示修改前后的数据变更
- **响应式设计**：适配不同屏幕尺寸
- **实时刷新**：支持手动刷新获取最新数据

## 🔒 已记录的操作类型

### 1. 用户管理 (user)
- **password_change**: 管理员强制修改用户密码
- **status_change**: 用户状态变更（启用/禁用）
- **role_change**: 用户角色变更

### 2. 会员管理 (membership)
- **membership_adjust**: 会员天数调整（增加/减少/设置）
- **status_change**: 会员状态变更
- **plan_change**: 会员套餐变更

### 3. 技术支持 (tech_support)
- **update**: 技术支持联系信息更新
- **create**: 创建技术支持信息
- **delete**: 删除技术支持信息

### 4. 系统管理 (system)
- **config_change**: 系统配置变更
- **maintenance**: 系统维护操作

## 🎯 使用场景

### 安全审计
- 追踪所有管理员操作
- 发现异常操作行为
- 安全事件调查

### 合规要求
- 满足数据保护法规要求
- 提供完整的操作审计链
- 支持合规性检查

### 故障排查
- 快速定位问题操作
- 查看数据变更历史
- 恢复误操作数据

### 管理监督
- 监控管理员操作行为
- 评估操作合理性
- 提供管理决策依据

## 🚀 访问方式

- **后台管理地址**: `http://localhost:3000/operation-logs`
- **管理员账号**: `admin / admin123`
- **权限要求**: 需要管理员权限才能访问

## 📈 扩展建议

1. **告警机制**: 对敏感操作设置实时告警
2. **数据导出**: 支持日志数据导出为Excel/CSV
3. **自动清理**: 定期清理过期日志数据
4. **权限细分**: 不同级别管理员查看不同范围的日志
5. **操作回滚**: 对某些操作支持一键回滚功能

这个操作日志系统为您的VPN管理后台提供了完整的操作追踪和审计能力，确保系统的安全性和可管理性！
