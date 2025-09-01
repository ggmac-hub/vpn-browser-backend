#!/bin/bash

# VPN浏览器后端快速启动脚本
# 简化版本，适合开发环境快速启动

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 切换到脚本所在目录
cd "$(dirname "$0")"

print_message $CYAN "🚀 VPN浏览器后端快速启动"
echo ""

# 设置环境变量
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3000}

print_message $BLUE "📦 安装依赖..."
npm install --silent

print_message $BLUE "🎨 检查前端构建..."
if [ ! -d "frontend/dist" ]; then
    print_message $YELLOW "构建前端..."
    cd frontend && npm install --silent && npm run build && cd ..
fi

print_message $GREEN "✅ 准备完成，启动服务器..."
print_message $YELLOW "访问地址: http://localhost:$PORT"
print_message $YELLOW "管理员: admin / admin123"
echo ""

# 启动服务器
if command -v nodemon &> /dev/null && [ "$NODE_ENV" = "development" ]; then
    nodemon server.js
else
    node server.js
fi
