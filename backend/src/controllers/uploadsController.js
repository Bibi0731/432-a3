// src/controllers/uploadsController.js
const fs = require("fs");
const path = require("path");
const uploadModel = require("../models/uploadModel");
const { getPaging, paginateArray } = require("../utils/pagination");
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION;
const s3 = new S3Client({ region });

// ---------------- 上传文件 ----------------
exports.create = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const filePath = path.join(process.cwd(), req.file.path);
        const fileContent = fs.readFileSync(filePath);

        const s3Key = `uploads/${req.file.filename}`;
        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: fileContent,
            ContentType: req.file.mimetype,
        }));

        fs.unlinkSync(filePath);

        const { displayName = "", note = "" } = req.body || {};
        const ownerId = req.user.userId;

        const record = await uploadModel.create({
            ownerId,
            filename: s3Key,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            displayName,
            note,
            updatedAt: new Date().toISOString()
        });

        res.status(201).json(record);
    } catch (err) {
        console.error("Upload create error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
};

// ---------------- 查询上传 ----------------
exports.getAllMine = async (req, res) => {
    try {
        const ownerId = req.user.userId;
        const groups = req.user["cognito:groups"] || [];

        let all;
        if (groups.includes("admin")) {
            all = await uploadModel.getAll();
        } else {
            all = await uploadModel.getByOwner(ownerId);
        }

        const paging = getPaging(req, { defaultPageSize: 10, maxPageSize: 100 });
        const q = (req.query.q || "").toLowerCase();

        const filtered = q
            ? all.filter(x =>
                (x.displayName || "").toLowerCase().includes(q) ||
                (x.originalName || "").toLowerCase().includes(q)
            )
            : all;

        const result = {
            items: paginateArray(filtered, paging).items,
            page: paging.page,
            totalPages: Math.ceil(filtered.length / paging.pageSize),
            totalItems: filtered.length,
        };

        res.json(result);
    } catch (err) {
        console.error("getAllMine error:", err);
        res.status(500).json({ error: "Failed to fetch uploads" });
    }
};

// ---------------- 其余部分保持不变 ----------------
exports.getOne = async (req, res) => {
    try {
        const ownerId = req.user.userId;
        const groups = req.user["cognito:groups"] || [];
        const item = await uploadModel.getById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });

        if (!groups.includes("admin") && String(item.ownerId) !== String(ownerId)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch upload" });
    }
};

exports.update = async (req, res) => {
    try {
        const ownerId = req.user.userId;
        const id = req.params.id;
        const patch = { displayName: req.body.displayName, note: req.body.note };

        const updated = await uploadModel.update(id, ownerId, patch);
        if (updated === "forbidden") return res.status(403).json({ error: "Forbidden" });
        if (!updated) return res.status(404).json({ error: "Not found" });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
};

exports.remove = async (req, res) => {
    try {
        const ownerId = req.user.userId;
        const groups = req.user["cognito:groups"] || [];
        const item = await uploadModel.getById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });

        if (!groups.includes("admin") && String(item.ownerId) !== String(ownerId)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        if (groups.includes("admin")) {
            await uploadModel.removeAdmin(req.params.id);
        } else {
            await uploadModel.remove(req.params.id, ownerId);
        }

        try {
            await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: item.filename }));
        } catch (err) {
            console.error("S3 delete error:", err);
        }

        res.status(200).json({ message: "File deleted successfully", deleted: item });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
};

exports.getDownloadLink = async (req, res) => {
    try {
        const ownerId = req.user.userId;
        const groups = req.user["cognito:groups"] || [];
        const item = await uploadModel.getById(req.params.id);

        if (!item) return res.status(404).json({ error: "Not found" });
        if (!groups.includes("admin") && String(item.ownerId) !== String(ownerId)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const command = new GetObjectCommand({ Bucket: bucketName, Key: item.filename });
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        res.json({ downloadUrl: url });
    } catch (err) {
        console.error("Presign error:", err);
        res.status(500).json({ error: "Could not generate download link" });
    }
};
