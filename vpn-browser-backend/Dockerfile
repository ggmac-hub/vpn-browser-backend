# 使用官方Node.js运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制前端package.json并安装依赖
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# 复制源代码
COPY . .

# 构建前端
RUN cd frontend && npm run build

# 创建数据库目录
RUN mkdir -p /app/database

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动应用
CMD ["node", "server.js"]
