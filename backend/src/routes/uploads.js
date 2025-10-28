const express = require("express");
const router = express.Router();
const verifyCognitoJWT = require("../middleware/verifyCognitoJWT");
const uploadsController = require("../controllers/uploadsController");
const upload = require("../middleware/upload"); // S3 上传中间件

// 路由（全部需要 Cognito 登录）
router.post("/", verifyCognitoJWT, upload.single("file"), uploadsController.create);
router.get("/", verifyCognitoJWT, uploadsController.getAllMine);
router.get("/:id", verifyCognitoJWT, uploadsController.getOne);
router.patch("/:id", verifyCognitoJWT, uploadsController.update);
router.delete("/:id", verifyCognitoJWT, uploadsController.remove);
router.get("/:id/download-link", verifyCognitoJWT, uploadsController.getDownloadLink);

module.exports = router;
