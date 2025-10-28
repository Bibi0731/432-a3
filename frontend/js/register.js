const API_BASE = "/auth";

// 注册表单提交
document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Register failed");

        alert("Register successful! Please check your email for confirmation code.");

        // 显示验证码确认框
        document.getElementById("registerForm").style.display = "none";
        document.getElementById("confirmBox").style.display = "block";
    } catch (err) {
        alert("Register failed: " + err.message);
    }
});

// 确认邮箱验证码
document.getElementById("confirmBtn").addEventListener("click", async () => {
    const username = document.getElementById("username").value;
    const code = document.getElementById("code").value;

    try {
        const res = await fetch(`${API_BASE}/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, code })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Confirmation failed");

        alert("Account confirmed! You can now login.");
        window.location.href = "login.html";
    } catch (err) {
        alert("Confirmation failed: " + err.message);
    }
});
