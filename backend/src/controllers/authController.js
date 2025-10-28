const {
    CognitoIdentityProviderClient,
    SignUpCommand,
    ConfirmSignUpCommand,
    InitiateAuthCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const jwt = require("jsonwebtoken"); // 这里只用来 decode，不再签发
const crypto = require("crypto"); // 用来生成 SECRET_HASH

// 初始化 Cognito 客户端
const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
});

// 生成 secret hash
function generateSecretHash(username) {
    return crypto
        .createHmac("SHA256", process.env.COGNITO_CLIENT_SECRET)
        .update(username + process.env.COGNITO_CLIENT_ID)
        .digest("base64");
}

// ----------------- 健康检查 -----------------
exports.healthCheck = (req, res) => {
    res.json({ status: "ok" });
};

// ----------------- 注册 -----------------
exports.register = async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res
            .status(400)
            .json({ error: "Username, email and password required" });
    }

    try {
        const command = new SignUpCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: username,
            Password: password,
            SecretHash: generateSecretHash(username),
            UserAttributes: [{ Name: "email", Value: email }],
        });

        await client.send(command);
        res.status(201).json({
            message:
                "User registered successfully. Please check your email for confirmation code.",
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ----------------- 确认注册 -----------------
exports.confirm = async (req, res) => {
    const { username, code } = req.body;
    if (!username || !code) {
        return res
            .status(400)
            .json({ error: "Username and confirmation code required" });
    }

    try {
        const command = new ConfirmSignUpCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: username,
            ConfirmationCode: code,
            SecretHash: generateSecretHash(username),
        });

        await client.send(command);
        res.json({ message: "User confirmed successfully." });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ----------------- 登录 -----------------
exports.login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res
            .status(400)
            .json({ error: "Username and password required" });
    }

    try {
        const command = new InitiateAuthCommand({
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: process.env.COGNITO_CLIENT_ID,
            AuthParameters: {
                USERNAME: username,
                PASSWORD: password,
                SECRET_HASH: generateSecretHash(username),
            },
        });

        const response = await client.send(command);

        // ✅ 返回 idToken，前端用 data.idToken 即可
        res.json({
            message: "Login successful",
            idToken: response.AuthenticationResult.IdToken,
            accessToken: response.AuthenticationResult.AccessToken,
            refreshToken: response.AuthenticationResult.RefreshToken,
        });
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
};

// ----------------- 获取当前用户信息 -----------------
exports.getUserInfo = (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.decode(token, { complete: true }); // ⚠️ decode 不验证签名
        res.json({ user: decoded.payload });
    } catch (err) {
        res.status(400).json({ error: "Invalid token" });
    }
};
