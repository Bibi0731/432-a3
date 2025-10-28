FROM node:20-slim

# 安装 ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# 进入 backend 工作目录
WORKDIR /app/backend

# 先复制依赖文件（利用缓存）
COPY backend/package*.json ./

RUN npm install --production

# 复制后端代码
COPY backend ./

# 复制前端代码到同级目录
COPY frontend ../frontend

# 暴露端口
EXPOSE 3000

# 启动后端
CMD ["npm", "start"]
