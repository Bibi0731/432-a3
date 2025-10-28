const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const verifyCognitoJWT = require("../middleware/verifyCognitoJWT"); // 新中间件

// 健康检查
router.get("/health", authController.healthCheck);

// 用户注册 & 确认
router.post("/register", authController.register);
router.post("/confirm", authController.confirm); // 👈 新增

// 登录
router.post("/login", authController.login);

// 获取当前用户信息（需要验证 Cognito JWT）
router.get("/me", verifyCognitoJWT, authController.getUserInfo);

module.exports = router;
