const uploadForm = document.getElementById("uploadForm");
const transcodeBtn = document.getElementById("transcodeBtn");
const statusEl = document.getElementById("status");

let lastUploadId = null; // 保存最近一次上传的视频 ID

// 绑定上传表单提交事件
uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = document.getElementById("videoFile").files[0];
    const displayName = document.getElementById("displayName").value;
    const note = document.getElementById("note").value;

    if (!file) {
        alert("Please select a video file");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("displayName", displayName);
    formData.append("note", note);

    try {
        statusEl.textContent = "📤 Uploading...";
        const uploadRes = await fetchWithAuth("/uploads", {
            method: "POST",
            body: formData
        });

        console.log("Upload response:", uploadRes);

        lastUploadId = uploadRes.id; // 保存上传的 ID
        statusEl.textContent = "✅ Upload successful! Now you can transcode.";

        // 显示转码按钮
        transcodeBtn.style.display = "inline-block";
    } catch (err) {
        console.error(err);
        statusEl.textContent = "❌ Upload failed: " + err.message;
    }
});

// 绑定转码按钮点击事件
transcodeBtn.addEventListener("click", async () => {
    if (!lastUploadId) {
        alert("Please upload a file first.");
        return;
    }

    const displayName = document.getElementById("displayName").value;
    const note = document.getElementById("note").value;

    try {
        statusEl.textContent = "⚙️ Transcoding...";
        const transcodeRes = await fetchWithAuth(`/outputs/${lastUploadId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                displayName,
                note
            })
        });

        console.log("Transcode response:", transcodeRes);
        statusEl.textContent = "✅ Transcoding complete!";
    } catch (err) {
        console.error(err);
        statusEl.textContent = "❌ Transcoding failed: " + err.message;
    }
});
