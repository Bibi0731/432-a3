// transcode-service/server.js
import express from "express";
import bodyParser from "body-parser";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3";

const app = express();
app.use(bodyParser.json());

// 环境变量
const region = process.env.AWS_REGION;
const bucketName = process.env.AWS_S3_BUCKET;
const port = process.env.PORT || 5000; // change to5000

// S3 client
const s3 = new S3Client({ region });
const TMP_DIR = os.tmpdir();
const streamPipeline = promisify(pipeline);

// 工具函数：下载 S3 文件
async function downloadFromS3(bucket, key, localPath) {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const writeStream = fs.createWriteStream(localPath);
    await streamPipeline(response.Body, writeStream);
}

// 工具函数：上传 S3 文件
async function uploadToS3(bucket, key, filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: fileBuffer,
            ContentType: "video/mp4",
        })
    );
    return fileBuffer.length;
}

// 主接口：接收转码请求
app.post("/start", async (req, res) => {
    const { bucketName, key, ownerId, uploadId, originalName, displayName, note } = req.body;

    if (!bucketName || !key) {
        return res.status(400).json({ error: "Missing bucketName or key" });
    }

    console.log(`🎬 Received transcoding request for: ${key}`);

    const localSrc = path.join(TMP_DIR, `${Date.now()}-src.mp4`);
    const localOut = path.join(TMP_DIR, `${Date.now()}-out.mp4`);

    try {
        // 1️⃣ 下载源视频
        console.log("⬇️  Downloading from S3...");
        await downloadFromS3(bucketName, key, localSrc);

        // 2️⃣ 执行转码
        console.log("🎞️  Starting ffmpeg...");
        ffmpeg(localSrc)
            .outputOptions([
                "-c:v libx264",
                "-preset fast",
                "-crf 28",
                "-c:a aac",
                "-b:a 128k",
            ])
            .on("end", async () => {
                try {
                    console.log("✅ Transcoding finished, uploading back to S3...");

                    const outKey = `outputs/${Date.now()}-${path.basename(localOut)}`;
                    const size = await uploadToS3(bucketName, outKey, localOut);

                    // 清理本地缓存
                    try { fs.unlinkSync(localSrc); } catch { }
                    try { fs.unlinkSync(localOut); } catch { }

                    console.log("✅ Uploaded:", outKey);
                    res.json({ outKey, size });
                } catch (err) {
                    console.error("Upload failed:", err);
                    res.status(500).json({ error: "Failed to upload output" });
                }
            })
            .on("error", (err) => {
                console.error("❌ FFmpeg error:", err);
                res.status(500).json({ error: "Transcoding failed", details: err.message });
            })
            .save(localOut);
    } catch (err) {
        console.error("❌ Transcode service error:", err);
        res.status(500).json({ error: "Transcode service failed", details: err.message });
    }
});

// 健康检查接口（可选）
app.get("/", (req, res) => {
    res.send("Transcode service is running ✅");
});

// 启动服务
const PORT = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`🚀 Transcode service running on http://localhost:${PORT}`);
});
