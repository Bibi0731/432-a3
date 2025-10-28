let uploadPage = 1;
let outputPage = 1;
let pageSize = 5;
let uploadQuery = "";
let outputQuery = "";

// ================= Uploads =================
async function loadUploads(page = 1, q = "") {
    try {
        const data = await fetchWithAuth(`/uploads?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`);
        renderUploads(data.items);
        renderPagination("uploadsPagination", data.page, data.totalPages, loadUploads);
    } catch (err) {
        alert("Failed to load uploads");
        console.error(err);
    }
}

function renderUploads(items) {
    const tbody = document.getElementById("uploadsTable");
    tbody.innerHTML = "";
    items.forEach(upload => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${upload.id}</td>
            <td contenteditable="true" data-field="displayName" data-id="${upload.id}">${upload.displayName || ""}</td>
            <td>${upload.originalName}</td>
            <td contenteditable="true" data-field="note" data-id="${upload.id}">${upload.note || ""}</td>
            <td>
                <button onclick="downloadUpload('${upload.id}')">Download</button>
                <button onclick="deleteUpload('${upload.id}')">Delete</button>
                <button onclick="transcodeUpload('${upload.id}', '${upload.displayName || upload.originalName}')">Transcode</button>
                <span id="status-upload-${upload.id}" class="status"></span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ================= Outputs =================
async function loadOutputs(page = 1, q = "") {
    try {
        const data = await fetchWithAuth(`/outputs?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`);
        renderOutputs(data.items);
        renderPagination("outputsPagination", data.page, data.totalPages, loadOutputs);
    } catch (err) {
        alert("Failed to load outputs");
        console.error(err);
    }
}

function renderOutputs(items) {
    const tbody = document.getElementById("outputsTable");
    tbody.innerHTML = "";
    items.forEach(output => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${output.id}</td>
            <td contenteditable="true" data-field="displayName" data-id="${output.id}" data-type="output">${output.displayName || ""}</td>
            <td>${output.originalName}</td>
            <td contenteditable="true" data-field="note" data-id="${output.id}" data-type="output">${output.note || ""}</td>
            <td>
                <button onclick="downloadOutput('${output.id}')">Download</button>
                <button onclick="deleteOutput('${output.id}')">Delete</button>
                <span id="status-output-${output.id}" class="status"></span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ================= Actions =================
async function downloadUpload(id) {
    try {
        const res = await fetchWithAuth(`/uploads/${id}/download-link`);
        if (res.downloadUrl) {
            window.open(res.downloadUrl, "_blank");
        } else {
            alert("Download link not available");
        }
    } catch (err) {
        alert("Download failed: " + err.message);
    }
}

async function deleteUpload(id) {
    if (!confirm("Delete this upload?")) return;
    await fetchWithAuth(`/uploads/${id}`, { method: "DELETE" });
    loadUploads(uploadPage, uploadQuery);
}

async function transcodeUpload(id, displayName) {
    const statusEl = document.getElementById(`status-upload-${id}`);
    statusEl.textContent = "⏳ Starting...";
    try {
        const res = await fetchWithAuth(`/outputs/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayName: displayName + " (transcoded)", note: "Transcoded via My Documents" })
        });
        console.log("Transcode response:", res);
        statusEl.textContent = "✅ Complete!";
        setTimeout(() => { statusEl.textContent = ""; }, 3000);
        loadOutputs(outputPage, outputQuery);
    } catch (err) {
        statusEl.textContent = "❌ Failed!";
        console.error(err);
    }
}

async function downloadOutput(id) {
    const res = await fetchWithAuth(`/outputs/${id}/download-link`);
    if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank");
    } else {
        alert("Download link not available");
    }
}

async function deleteOutput(id) {
    if (!confirm("Delete this output?")) return;
    await fetchWithAuth(`/outputs/${id}`, { method: "DELETE" });
    loadOutputs(outputPage, outputQuery);
}

// ================= Inline Editing =================
document.addEventListener("blur", async (e) => {
    if (e.target.matches("[contenteditable]")) {
        const id = e.target.dataset.id;
        const field = e.target.dataset.field;
        const type = e.target.dataset.type || "upload"; // 默认 upload
        const value = e.target.innerText;

        const url = type === "upload" ? `/uploads/${id}` : `/outputs/${id}`;
        try {
            await fetchWithAuth(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value })
            });
            const statusEl = document.getElementById(`status-${type}-${id}`);
            statusEl.textContent = "✅ Updated!";
            setTimeout(() => { statusEl.textContent = ""; }, 2000);
        } catch (err) {
            alert("Update failed");
            console.error(err);
        }
    }
}, true);

// ================= Pagination Renderer =================
function renderPagination(containerId, currentPage, totalPages, callback) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "Prev";
    prevBtn.disabled = currentPage <= 1;
    prevBtn.onclick = () => callback(currentPage - 1);
    container.appendChild(prevBtn);

    const info = document.createElement("span");
    info.textContent = ` Page ${currentPage} / ${totalPages} `;
    container.appendChild(info);

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.onclick = () => callback(currentPage + 1);
    container.appendChild(nextBtn);
}

// ================= Init =================
document.addEventListener("DOMContentLoaded", () => {
    loadUploads(uploadPage, uploadQuery);
    loadOutputs(outputPage, outputQuery);

    document.getElementById("searchUploadsBtn").addEventListener("click", () => {
        uploadQuery = document.getElementById("searchUploads").value;
        loadUploads(1, uploadQuery);
    });

    document.getElementById("searchOutputsBtn").addEventListener("click", () => {
        outputQuery = document.getElementById("searchOutputs").value;
        loadOutputs(1, outputQuery);
    });

    document.getElementById("logoutBtn").addEventListener("click", () => {
        logout();
    });
});
