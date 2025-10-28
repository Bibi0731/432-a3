const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const region = process.env.AWS_REGION || "ap-southeast-2";
const client = new SecretsManagerClient({ region });

async function loadSecrets() {
    try {
        const secretName = "a2-group31"; // 👈 你的 secret 名字
        const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));

        if (response.SecretString) {
            const secret = JSON.parse(response.SecretString);

            // 注入到 process.env
            if (secret.JWT_SECRET) process.env.JWT_SECRET = secret.JWT_SECRET;
            if (secret.COGNITO_CLIENT_SECRET) process.env.COGNITO_CLIENT_SECRET = secret.COGNITO_CLIENT_SECRET;
            if (secret.DB_USER) process.env.DB_USER = secret.DB_USER;
            if (secret.DB_PASSWORD) process.env.DB_PASSWORD = secret.DB_PASSWORD;

            console.log("✅ Secrets loaded from AWS Secrets Manager");
        }
    } catch (err) {
        console.error("❌ Failed to load secrets:", err);
    }
}

module.exports = { loadSecrets };
