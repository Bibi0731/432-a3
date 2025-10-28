// 后端 API 根路径（同域部署可以简写为 ""）
const API_BASE = "";

// 从 localStorage 里获取 token
function getToken() {
    const token = localStorage.getItem("token");
    console.log("[common.js] 当前 token:", token ? token.substring(0, 30) + "..." : "无");
    return token;
}

// 退出登录
function logout() {
    localStorage.removeItem("token");
    console.log("[common.js] 已清除 token");
    window.location.href = "index.html";
}

// 请求带 token
async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    if (!options.headers) options.headers = {};
    if (token) {
        options.headers["Authorization"] = "Bearer " + token;
        console.log("[common.js] 请求头已带上 Authorization");
    } else {
        console.warn("[common.js] 没有 token，可能会 401/403");
    }

    const res = await fetch(API_BASE + url, options);

    if (!res.ok) {
        console.error("[common.js] API Error", res.status, url);
        throw new Error("API Error: " + res.status);
    }

    return res.json();
}
