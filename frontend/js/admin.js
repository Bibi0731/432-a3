let userPage = 1;
let uploadPage = 1;
let outputPage = 1;
let pageSize = 5;

// ================= 权限检测 =================
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const me = await fetchWithAuth("/auth/me");
        if (me.user.role !== "admin") {
            alert("You are not an admin!");
            window.location.href = "dashboard.html";
            return;
        }
        // 加载数据
        loadUsers(userPage);
        loadUploads(uploadPage);
        loadOutputs(outputPage);
    } catch (err) {
        console.error(err);
        logout(); // token 过期
    }

    document.getElementById("logoutBtn").addEventListener("click", () => {
        logout();
    });
});

// ================= Users =================
async function loadUsers(page = 1) {
    const data = await fetchWithAuth(`/admin/users?page=${page}&pageSize=${pageSize}`);
    renderUsers(data.items);
    renderPagination("usersPagination", data.page, data.totalPages, loadUsers);
}

function renderUsers(items) {
    const tbody = document.getElementById("usersTable");
    tbody.innerHTML = "";
    items.forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${u.id}</td><td>${u.username}</td><td>${u.role}</td>`;
        tbody.appendChild(tr);
    });
}

// ================= Uploads =================
async function loadUploads(page = 1) {
    const data = await fetchWithAuth(`/admin/uploads?page=${page}&pageSize=${pageSize}`);
    renderUploads(data.items);
    renderPagination("uploadsPagination", data.page, data.totalPages, loadUploads);
}

function renderUploads(items) {
    const tbody = document.getElementById("uploadsTable");
    tbody.innerHTML = "";
    items.forEach(up => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${up.id}</td>
      <td>${up.ownerId}</td>
      <td>${up.originalName}</td>
      <td>${up.displayName || ""}</td>
      <td>${up.note || ""}</td>
      <td><button onclick="deleteUpload(${up.id})">Delete</button></td>
    `;
        tbody.appendChild(tr);
    });
}

async function deleteUpload(id) {
    if (!confirm("Delete this upload (and related outputs)?")) return;
    await fetchWithAuth(`/admin/uploads/${id}`, { method: "DELETE" });
    loadUploads(uploadPage);
    loadOutputs(outputPage); // 刷新 outputs（因为级联删除）
}

// ================= Outputs =================
async function loadOutputs(page = 1) {
    const data = await fetchWithAuth(`/admin/outputs?page=${page}&pageSize=${pageSize}`);
    renderOutputs(data.items);
    renderPagination("outputsPagination", data.page, data.totalPages, loadOutputs);
}

function renderOutputs(items) {
    const tbody = document.getElementById("outputsTable");
    tbody.innerHTML = "";
    items.forEach(out => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${out.id}</td>
      <td>${out.ownerId}</td>
      <td>${out.originalName}</td>
      <td>${out.displayName || ""}</td>
      <td>${out.note || ""}</td>
      <td><button onclick="deleteOutput(${out.id})">Delete</button></td>
    `;
        tbody.appendChild(tr);
    });
}

async function deleteOutput(id) {
    if (!confirm("Delete this output?")) return;
    await fetchWithAuth(`/admin/outputs/${id}`, { method: "DELETE" });
    loadOutputs(outputPage);
}

// ================= Pagination Helper =================
function renderPagination(containerId, currentPage, totalPages, callback) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    const prev = document.createElement("button");
    prev.textContent = "Prev";
    prev.disabled = currentPage <= 1;
    prev.onclick = () => callback(currentPage - 1);
    container.appendChild(prev);

    const info = document.createElement("span");
    info.textContent = ` Page ${currentPage} / ${totalPages} `;
    container.appendChild(info);

    const next = document.createElement("button");
    next.textContent = "Next";
    next.disabled = currentPage >= totalPages;
    next.onclick = () => callback(currentPage + 1);
    container.appendChild(next);
}
