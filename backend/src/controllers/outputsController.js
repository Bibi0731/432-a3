// src/controllers/outputsController.js
const outputModel = require('../models/outputModel');
const uploadModel = require('../models/uploadModel');
const axios = require('axios'); // ✅ 新增，用于调用转码微服务
const { getPaging, paginateArray } = require('../utils/pagination');
const cache = require('../utils/cache');

const {
    S3Client,
    DeleteObjectCommand,
    GetObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION;
const s3 = new S3Client({ region });

// 你的转码服务地址（以后部署到另一台 EC2 时改成公网 IP）
const TRANSCODE_SERVICE_URL = process.env.TRANSCODE_SERVICE_URL || "http://localhost:4000";


// ---------------- 创建转码结果 ----------------
async function create(req, res) {
    const ownerId = req.user.userId;
    const uploadId = req.params.uploadId;
    const { displayName, note } = req.body;

    try {
        const upload = await uploadModel.getById(uploadId);
        if (!upload || String(upload.ownerId) !== String(ownerId)) {
            return res.status(404).json({ error: "Upload not found" });
        }

        // ✅ 改动：转码交给独立服务
        const transcodePayload = {
            bucketName,
            key: upload.filename,
            ownerId,
            uploadId,
            originalName: upload.originalName,
            displayName,
            note
        };

        const response = await axios.post(`${TRANSCODE_SERVICE_URL}/start`, transcodePayload, {
            timeout: 600000 // 最长等 10 分钟
        });

        if (response.status !== 200) {
            return res.status(500).json({ error: "Transcode service error" });
        }

        // ✅ 收到转码结果后写数据库
        const { outKey, size } = response.data;

        const newOutput = await outputModel.create({
            ownerId,
            uploadId,
            filename: outKey,
            originalName: upload.originalName,
            mimeType: "video/mp4",
            size: size || 0,
            displayName:
                displayName || `${upload.displayName || upload.originalName} (transcoded)`,
            note: note || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        return res.status(201).json({
            message: "Transcode complete",
            output: newOutput,
        });

    } catch (err) {
        console.error("Transcode request failed:", err.message);
        return res.status(500).json({ error: "Failed to trigger transcoding", details: err.message });
    }
}


// ---------------- 获取所有转码结果 ----------------
async function getAllMine(req, res) {
    try {
        const ownerId = req.user.userId;
        const groups = req.user["cognito:groups"] || [];

        let items;
        if (groups.includes("admin")) {
            items = await outputModel.getAll();
        } else {
            items = await outputModel.getByOwner(ownerId);
        }

        const paging = getPaging(req, { defaultPageSize: 5, maxPageSize: 100 });
        const q = (req.query.q || "").toLowerCase();

        const filtered = q
            ? items.filter(
                (x) =>
                    (x.displayName || "").toLowerCase().includes(q) ||
                    (x.originalName || "").toLowerCase().includes(q)
            )
            : items;

        const result = {
            items: paginateArray(filtered, paging).items,
            page: paging.page,
            totalPages: Math.ceil(filtered.length / paging.pageSize),
            totalItems: filtered.length,
        };

        res.json(result);
    } catch (err) {
        console.error("getAllMine error:", err);
        res.status(500).json({ error: "Failed to fetch outputs" });
    }
}


// ---------------- 获取单个转码结果 ----------------
async function getOne(req, res) {
    try {
        const ownerId = req.user.userId;
        const groups = req.user["cognito:groups"] || [];
        const item = await outputModel.getById(req.params.id);

        if (!item) return res.status(404).json({ error: "Not found" });
        if (!groups.includes("admin") && String(item.ownerId) !== String(ownerId)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch output" });
    }
}


// ---------------- 更新转码元数据 ----------------
async function update(req, res) {
    try {
        const ownerId = req.user.userId;
        const updated = await outputModel.update(req.params.id, ownerId, req.body);
        if (updated === "forbidden") return res.status(403).json({ error: "Forbidden" });
        if (!updated) return res.status(404).json({ error: "Not found" });

        res.json({ message: "Output updated", output: updated });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
}


// ---------------- 删除转码结果 ----------------
async function remove(req, res) {
    try {
        const ownerId = req.user.userId;
        const groups = req.user["cognito:groups"] || [];
        const item = await outputModel.getById(req.params.id);

        if (!item) return res.status(404).json({ error: "Not found" });

        if (!groups.includes("admin") && String(item.ownerId) !== String(ownerId)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        if (groups.includes("admin")) {
            await outputModel.removeAdmin(req.params.id);
        } else {
            await outputModel.remove(req.params.id, ownerId);
        }

        try {
            await s3.send(new DeleteObjectCommand({
                Bucket: bucketName,
                Key: item.filename,
            }));
        } catch (err) {
            console.error("S3 delete error:", err);
        }

        res.json({ message: "Output deleted", deleted: item });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
}


// ---------------- 获取下载链接 ----------------
async function getDownloadLink(req, res) {
    try {
        const ownerId = req.user.userId;
        const groups = req.user["cognito:groups"] || [];
        const item = await outputModel.getById(req.params.id);

        if (!item) return res.status(404).json({ error: "Not found" });
        if (!groups.includes("admin") && String(item.ownerId) !== String(ownerId)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: item.filename,
        });
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        res.json({ downloadUrl: url });
    } catch (err) {
        console.error("Presign error:", err);
        res.status(500).json({ error: "Could not generate download link" });
    }
}


// ---------------- 导出 ----------------
module.exports = {
    create,
    getAllMine,
    getOne,
    update,
    remove,
    getDownloadLink,
};
