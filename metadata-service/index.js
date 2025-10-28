const express = require("express");
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 4000;

const s3 = new S3Client({ region: process.env.AWS_REGION });

app.get("/metadata/:filename", async (req, res) => {
    try {
        const bucket = process.env.AWS_S3_BUCKET;
        const key = req.params.filename;

        const data = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

        res.json({
            filename: key,
            size: data.ContentLength,
            type: data.ContentType,
            lastModified: data.LastModified,
        });
    } catch (err) {
        console.error("❌ Metadata fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch metadata" });
    }
});

app.listen(port, () => {
    console.log(`✅ Metadata Service running on port ${port}`);
});
