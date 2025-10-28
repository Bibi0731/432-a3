const express = require("express");
const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");

const app = express();
const port = process.env.PORT || 4001;

// 假设你把转码记录存储在一个 JSON 文件中（或者以后接 DB）
const dataPath = path.join(__dirname, "transcode-records.json");

// 示例数据（测试用）
if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(
        dataPath,
        JSON.stringify([
            { id: 1, filename: "video1.mp4", status: "completed", duration: "3m20s" },
            { id: 2, filename: "video2.mp4", status: "failed", duration: null },
        ])
    );
}

app.get("/export", (req, res) => {
    const records = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    const json2csv = new Parser({ fields: ["id", "filename", "status", "duration"] });
    const csv = json2csv.parse(records);

    res.header("Content-Type", "text/csv");
    res.attachment("transcode-records.csv");
    return res.send(csv);
});

app.listen(port, () => {
    console.log(`✅ Export Service running on port ${port}`);
});
