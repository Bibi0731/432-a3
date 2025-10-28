const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");

// 加载本地 .env（保证 AWS_REGION 等基础变量有值）
dotenv.config();

// 加载工具函数
const { loadParameters } = require("./utils/loadParams");
const { loadSecrets } = require("./utils/loadSecrets");

async function startServer() {
    // 1. 从 Parameter Store 加载配置
    await loadParameters();

    // 2. 从 Secrets Manager 加载敏感数据
    await loadSecrets();

    // 3. 初始化 Express 应用
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors());
    app.use(morgan("dev"));

    // 4. 静态文件（本地调试时用）
    app.use("/uploads", express.static(path.join(process.cwd(), "data/uploads")));
    app.use("/outputs", express.static(path.join(process.cwd(), "data/outputs")));

    // 5. 前端静态文件
    app.use("/", express.static(path.join(__dirname, "..", "..", "frontend")));

    // 6. 路由
    const authRoutes = require("./routes/auth");
    app.use("/auth", authRoutes);

    const adminRoutes = require("./routes/admin");
    app.use("/admin", adminRoutes);

    const uploadsRoutes = require("./routes/uploads");
    app.use("/uploads", uploadsRoutes);

    const outputsRoutes = require("./routes/outputs");
    app.use("/outputs", outputsRoutes);

    // 7. Debug接口（演示 Parameter Store & Secrets Manager 已生效）
    app.get("/debug/config", (req, res) => {
        res.json({
            API_BASE_URL: process.env.API_BASE_URL,
            TRANSCODE_CONFIG: process.env.TRANSCODE_CONFIG,
            DB_USER: process.env.DB_USER || "not loaded",
            DB_PASSWORD: process.env.DB_PASSWORD ? "******" : "not loaded"
        });
    });

    // 8. 启动服务
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`✅ Server running at http://localhost:${PORT}`);
    });
}

// 启动入口
startServer().catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
});
