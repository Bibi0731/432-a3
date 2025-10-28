// src/transcodeTask.cjs
require("dotenv").config();
const {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
} = require("@aws-sdk/client-s3");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { promisify } = require("util");
const { pipeline } = require("stream");

const region = process.env.AWS_REGION;
const bucketName = process.env.AWS_S3_BUCKET;
const s3 = new S3Client({ region });
const streamPipeline = promisify(pipeline);
const TMP_DIR = os.tmpdir();

// 下载文件
async function downloadFromS3(bucket, key, localPath) {
    console.log(`⬇️  Downloading from S3: ${key}`);
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const writeStream = fs.createWriteStream(localPath);
    await streamPipeline(response.Body, writeStream);
}

// 上传文件
async function uploadToS3(bucket, key, filePath) {
    console.log(`⬆️  Uploading to S3: ${key}`);
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

// 主转码逻辑
async function transcodeTask(videoKey, outputFormat = "mp4") {
    const localSrc = path.join(TMP_DIR, `${Date.now()}-src.${outputFormat}`);
    const localOut = path.join(TMP_DIR, `${Date.now()}-out.${outputFormat}`);

    try {
        await downloadFromS3(bucketName, videoKey, localSrc);

        console.log("🎬 Starting ffmpeg...");
        await new Promise((resolve, reject) => {
            ffmpeg(localSrc)
                .outputOptions([
                    "-c:v libx264",
                    "-preset fast",
                    "-crf 28",
                    "-c:a aac",
                    "-b:a 128k",
                ])
                .on("end", resolve)
                .on("error", reject)
                .save(localOut);
        });

        const outKey = `outputs/${Date.now()}-${path.basename(localOut)}`;
        await uploadToS3(bucketName, outKey, localOut);
        console.log(`✅ Transcode complete. Uploaded: ${outKey}`);

        try { fs.unlinkSync(localSrc); } catch { }
        try { fs.unlinkSync(localOut); } catch { }

        return outKey;
    } catch (err) {
        console.error("❌ Transcode failed:", err);
        throw err;
    }
}

module.exports = { transcodeTask };
