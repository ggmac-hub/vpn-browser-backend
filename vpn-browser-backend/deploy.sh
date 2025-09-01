#!/bin/bash

# VPN浏览器后台管理系统部署脚本
# 适用于Ubuntu/Debian服务器

set -e

echo "🚀 开始部署VPN浏览器后台管理系统..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker未安装，正在安装Docker...${NC}"
    
    # 更新包管理器
    sudo apt-get update
    
    # 安装必要的包
    sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
    
    # 添加Docker官方GPG密钥
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # 添加Docker仓库
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 安装Docker
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    
    # 启动Docker服务
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # 将当前用户添加到docker组
    sudo usermod -aG docker $USER
    
    echo -e "${GREEN}✅ Docker安装完成${NC}"
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker Compose未安装，正在安装...${NC}"
    
    # 下载Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # 添加执行权限
    sudo chmod +x /usr/local/bin/docker-compose
    
    echo -e "${GREEN}✅ Docker Compose安装完成${NC}"
fi

# 检查Git是否安装
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠️  Git未安装，正在安装...${NC}"
    sudo apt-get update
    sudo apt-get install -y git
    echo -e "${GREEN}✅ Git安装完成${NC}"
fi

# 项目目录
PROJECT_DIR="/opt/vpn-browser-backend"
REPO_URL="https://github.com/YOUR_USERNAME/vpn-browser-backend.git"

echo -e "${YELLOW}📂 设置项目目录...${NC}"

# 如果项目目录不存在，克隆仓库
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}📥 克隆项目仓库...${NC}"
    sudo mkdir -p /opt
    sudo git clone $REPO_URL $PROJECT_DIR
    sudo chown -R $USER:$USER $PROJECT_DIR
else
    echo -e "${YELLOW}🔄 更新项目代码...${NC}"
    cd $PROJECT_DIR
    git pull origin main
fi

# 进入项目目录
cd $PROJECT_DIR

# 创建必要的目录
mkdir -p database logs

# 停止现有容器（如果存在）
echo -e "${YELLOW}🛑 停止现有容器...${NC}"
docker-compose down || true

# 构建并启动容器
echo -e "${YELLOW}🏗️  构建Docker镜像...${NC}"
docker-compose build

echo -e "${YELLOW}🚀 启动服务...${NC}"
docker-compose up -d

# 等待服务启动
echo -e "${YELLOW}⏳ 等待服务启动...${NC}"
sleep 10

# 检查服务状态
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ 部署成功！${NC}"
    echo -e "${GREEN}🌐 访问地址: http://$(curl -s ifconfig.me):3000${NC}"
    echo -e "${GREEN}👤 管理员账号: admin / admin123${NC}"
    
    # 显示容器状态
    echo -e "\n${YELLOW}📊 容器状态:${NC}"
    docker-compose ps
    
    # 显示日志
    echo -e "\n${YELLOW}📋 最近日志:${NC}"
    docker-compose logs --tail=20
else
    echo -e "${RED}❌ 部署失败，请检查日志${NC}"
    docker-compose logs
    exit 1
fi

echo -e "\n${GREEN}🎉 部署完成！${NC}"
echo -e "${YELLOW}💡 常用命令:${NC}"
echo -e "  查看日志: docker-compose logs -f"
echo -e "  重启服务: docker-compose restart"
echo -e "  停止服务: docker-compose down"
echo -e "  更新部署: ./deploy.sh"
