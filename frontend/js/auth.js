const API_BASE = "/auth"; // 后端路由前缀

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Login failed");
        }

        if (!data.idToken) {
            throw new Error("No idToken received from server");
        }

        // 保存 idToken
        localStorage.setItem("token", data.idToken);

        // 尝试解码
        try {
            const payload = JSON.parse(atob(data.idToken.split(".")[1]));
            console.log("JWT Payload:", payload);

            const role = payload.role || "user";
            if (role === "admin") {
                window.location.href = "admin.html";
            } else {
                window.location.href = "dashboard.html";
            }
        } catch (decodeErr) {
            console.error("JWT decode error:", decodeErr);
            alert("Login successful, but could not decode token.");
            window.location.href = "dashboard.html";
        }

    } catch (err) {
        console.error("Login error:", err);
        alert("Login failed: " + err.message);
    }
});
