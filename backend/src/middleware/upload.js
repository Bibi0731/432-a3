// src/middleware/upload.js
const multer = require("multer");
const path = require("path");

// 存到本地临时目录 tmp/
const storage = multer.diskStorage({
    destination: "tmp/",   // ⚠️ 确保项目根目录有 tmp 文件夹
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname); // 保留扩展名
        cb(null, Date.now() + ext); // 用时间戳生成唯一文件名
    },
});

const upload = multer({ storage });
module.exports = upload;
