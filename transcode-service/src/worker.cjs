// worker.cjs - Transcode Worker connected to SQS
require("dotenv").config();
const {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand,
} = require("@aws-sdk/client-sqs");
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

const streamPipeline = promisify(pipeline);
const region = process.env.AWS_REGION;
const bucketName = process.env.AWS_S3_BUCKET;
const queueUrl = process.env.SQS_QUEUE_URL;

// === AWS clients ===
const s3 = new S3Client({ region });
const sqs = new SQSClient({ region });
const TMP_DIR = os.tmpdir();

// === Helper: Download file from S3 ===
async function downloadFromS3(bucket, key, localPath) {
    console.log(`⬇️  Downloading from S3: ${key}`);
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const writeStream = fs.createWriteStream(localPath);
    await streamPipeline(response.Body, writeStream);
}

// === Helper: Upload file to S3 ===
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

// === Core Transcode Logic ===
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

// === Process One Job ===
async function processJob(message) {
    const { videoKey, outputFormat } = JSON.parse(message.Body);
    console.log(`🎬 Received job for ${videoKey} → ${outputFormat}`);
    try {
        const outKey = await transcodeTask(videoKey, outputFormat);
        console.log(`✅ Job finished: ${outKey}`);
    } catch (err) {
        console.error("❌ Job failed:", err);
    }
}

// === Poll Queue Continuously ===
async function pollQueue() {
    try {
        const data = await sqs.send(
            new ReceiveMessageCommand({
                QueueUrl: queueUrl,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 10,
            })
        );

        if (data.Messages) {
            for (const msg of data.Messages) {
                await processJob(msg);
                await sqs.send(
                    new DeleteMessageCommand({
                        QueueUrl: queueUrl,
                        ReceiptHandle: msg.ReceiptHandle,
                    })
                );
                console.log(`🧹 Deleted message ${msg.MessageId}`);
            }
        }
    } catch (err) {
        console.error("❌ Worker error:", err);
    } finally {
        setTimeout(pollQueue, 3000); // poll every 3s
    }
}

console.log("🚀 Transcode worker started, waiting for SQS messages...");
pollQueue();
