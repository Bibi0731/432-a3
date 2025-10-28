const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

// Cognito JWKS URL
const jwksUri = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

const client = jwksClient({
    jwksUri,
    cache: true,
    rateLimit: true,
});

// 根据 kid 获取签名公钥
function getKey(header, callback) {
    client.getSigningKey(header.kid, function (err, key) {
        if (err) {
            return callback(err);
        }
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

// 中间件
module.exports = function verifyCognitoJWT(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1]; // "Bearer <token>"

    jwt.verify(
        token,
        getKey,
        {
            algorithms: ["RS256"], // Cognito 默认 RS256
            issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
            audience: process.env.COGNITO_CLIENT_ID, // ✅ 检查 clientId，支持 idToken
        },
        (err, decoded) => {
            if (err) {
                return res
                    .status(403)
                    .json({ error: "Invalid token", details: err.message });
            }

            // ✅ 兼容旧逻辑，映射 userId
            req.user = {
                ...decoded,
                userId: decoded.sub, // Cognito 用户唯一 ID
                email: decoded.email || "",
            };

            next();
        }
    );
};
