#!/bin/bash

# VPN浏览器后端启动脚本
# 作者: VPN Browser Team
# 版本: 1.0.0

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目信息
PROJECT_NAME="VPN浏览器后端管理系统"
VERSION="1.0.0"
PORT=${PORT:-3000}

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 打印标题
print_title() {
    echo ""
    print_message $CYAN "=================================="
    print_message $CYAN "    $PROJECT_NAME v$VERSION"
    print_message $CYAN "=================================="
    echo ""
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_message $RED "❌ 错误: $1 未安装或不在PATH中"
        return 1
    fi
    return 0
}

# 检查系统环境
check_environment() {
    print_message $BLUE "🔍 检查系统环境..."
    
    # 检查Node.js
    if check_command "node"; then
        NODE_VERSION=$(node --version)
        print_message $GREEN "✅ Node.js: $NODE_VERSION"
    else
        print_message $RED "❌ 请先安装Node.js (建议版本 >= 16.0.0)"
        exit 1
    fi
    
    # 检查npm
    if check_command "npm"; then
        NPM_VERSION=$(npm --version)
        print_message $GREEN "✅ npm: v$NPM_VERSION"
    else
        print_message $RED "❌ 请先安装npm"
        exit 1
    fi
    
    # 检查端口是否被占用
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_message $YELLOW "⚠️  警告: 端口 $PORT 已被占用"
        print_message $YELLOW "正在尝试终止占用进程..."
        
        # 尝试终止占用端口的进程
        PID=$(lsof -ti:$PORT)
        if [ ! -z "$PID" ]; then
            kill -9 $PID 2>/dev/null || true
            sleep 2
            print_message $GREEN "✅ 已终止占用端口的进程"
        fi
    fi
    
    echo ""
}

# 安装依赖
install_dependencies() {
    print_message $BLUE "📦 检查并安装依赖..."
    
    # 检查package.json是否存在
    if [ ! -f "package.json" ]; then
        print_message $RED "❌ 错误: package.json 文件不存在"
        exit 1
    fi
    
    # 检查node_modules是否存在
    if [ ! -d "node_modules" ]; then
        print_message $YELLOW "⚠️  node_modules 不存在，正在安装依赖..."
        npm install
    else
        print_message $GREEN "✅ 依赖已存在，跳过安装"
    fi
    
    echo ""
}

# 检查前端构建
check_frontend() {
    print_message $BLUE "🎨 检查前端构建..."
    
    if [ ! -d "frontend/dist" ]; then
        print_message $YELLOW "⚠️  前端未构建，正在构建前端..."
        cd frontend
        if [ ! -d "node_modules" ]; then
            print_message $BLUE "📦 安装前端依赖..."
            npm install
        fi
        print_message $BLUE "🔨 构建前端..."
        npm run build
        cd ..
        print_message $GREEN "✅ 前端构建完成"
    else
        print_message $GREEN "✅ 前端已构建"
    fi
    
    echo ""
}

# 检查数据库
check_database() {
    print_message $BLUE "🗄️  检查数据库..."
    
    if [ ! -f "database/vpn_browser.db" ]; then
        print_message $YELLOW "⚠️  数据库文件不存在，将在启动时自动创建"
    else
        print_message $GREEN "✅ 数据库文件存在"
    fi
    
    echo ""
}

# 设置环境变量
setup_environment() {
    print_message $BLUE "🔧 设置环境变量..."
    
    # 设置默认环境变量
    export NODE_ENV=${NODE_ENV:-development}
    export PORT=${PORT:-3000}
    
    print_message $GREEN "✅ NODE_ENV: $NODE_ENV"
    print_message $GREEN "✅ PORT: $PORT"
    
    echo ""
}

# 启动服务器
start_server() {
    print_message $BLUE "🚀 启动服务器..."
    echo ""
    
    # 显示启动信息
    print_message $PURPLE "📋 启动信息:"
    print_message $CYAN "   • 项目名称: $PROJECT_NAME"
    print_message $CYAN "   • 版本: $VERSION"
    print_message $CYAN "   • 环境: $NODE_ENV"
    print_message $CYAN "   • 端口: $PORT"
    print_message $CYAN "   • 时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    print_message $GREEN "🎯 访问地址:"
    print_message $YELLOW "   • 管理后台: http://localhost:$PORT"
    print_message $YELLOW "   • API接口: http://localhost:$PORT/api"
    print_message $YELLOW "   • 健康检查: http://localhost:$PORT/api/health"
    echo ""
    
    print_message $CYAN "💡 默认管理员账号:"
    print_message $YELLOW "   • 用户名: admin"
    print_message $YELLOW "   • 密码: admin123"
    print_message $RED "   ⚠️  请登录后立即修改默认密码！"
    echo ""
    
    print_message $GREEN "🔥 服务器启动中..."
    echo ""
    
    # 启动服务器
    if [ "$NODE_ENV" = "development" ]; then
        # 开发模式使用nodemon
        if command -v nodemon &> /dev/null; then
            nodemon server.js
        else
            print_message $YELLOW "⚠️  nodemon未安装，使用node启动"
            node server.js
        fi
    else
        # 生产模式使用node
        node server.js
    fi
}

# 清理函数
cleanup() {
    print_message $YELLOW "🛑 正在关闭服务器..."
    # 这里可以添加清理逻辑
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM

# 主函数
main() {
    # 切换到脚本所在目录
    cd "$(dirname "$0")"
    
    # 显示标题
    print_title
    
    # 执行检查和启动流程
    check_environment
    install_dependencies
    check_frontend
    check_database
    setup_environment
    start_server
}

# 帮助信息
show_help() {
    echo ""
    print_message $CYAN "VPN浏览器后端启动脚本"
    echo ""
    print_message $YELLOW "用法:"
    print_message $WHITE "  ./start.sh [选项]"
    echo ""
    print_message $YELLOW "选项:"
    print_message $WHITE "  -h, --help     显示帮助信息"
    print_message $WHITE "  -p, --port     指定端口号 (默认: 3000)"
    print_message $WHITE "  -e, --env      指定环境 (development/production)"
    echo ""
    print_message $YELLOW "环境变量:"
    print_message $WHITE "  PORT           服务器端口 (默认: 3000)"
    print_message $WHITE "  NODE_ENV       运行环境 (默认: development)"
    echo ""
    print_message $YELLOW "示例:"
    print_message $WHITE "  ./start.sh                    # 使用默认设置启动"
    print_message $WHITE "  ./start.sh -p 8080           # 在端口8080启动"
    print_message $WHITE "  ./start.sh -e production     # 生产环境启动"
    print_message $WHITE "  PORT=8080 ./start.sh         # 使用环境变量指定端口"
    echo ""
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -e|--env)
            NODE_ENV="$2"
            shift 2
            ;;
        *)
            print_message $RED "❌ 未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 运行主函数
main
