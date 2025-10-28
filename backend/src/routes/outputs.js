const express = require("express");
const router = express.Router();
const verifyCognitoJWT = require("../middleware/verifyCognitoJWT");
const outputsController = require("../controllers/outputsController");

// ----------------- 路由 -----------------
router.post("/:uploadId", verifyCognitoJWT, outputsController.create);
router.get("/", verifyCognitoJWT, outputsController.getAllMine);

// 注意：要放在 /:id 前面
router.get("/:id/download-link", verifyCognitoJWT, outputsController.getDownloadLink);

router.get("/:id", verifyCognitoJWT, outputsController.getOne);
router.patch("/:id", verifyCognitoJWT, outputsController.update);
router.delete("/:id", verifyCognitoJWT, outputsController.remove);

module.exports = router;
