const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const region = process.env.AWS_REGION || "ap-southeast-2";
const ssm = new SSMClient({ region });

async function loadParameters() {
    try {
        const paramsToLoad = [
            { name: "/a2-group31/API_BASE_URL", envKey: "API_BASE_URL" },
            { name: "/a2-group31/TRANSCODE_CONFIG", envKey: "TRANSCODE_CONFIG" }
        ];

        for (const p of paramsToLoad) {
            try {
                const response = await ssm.send(new GetParameterCommand({ Name: p.name }));
                if (response.Parameter && response.Parameter.Value) {
                    process.env[p.envKey] = response.Parameter.Value;
                }
            } catch (err) {
                console.warn(`⚠️ Could not load parameter ${p.name}: ${err.message}`);
            }
        }

        console.log("✅ Parameters loaded from AWS SSM (where accessible)");
    } catch (err) {
        console.error("❌ Failed to load parameters:", err);
    }
}

module.exports = { loadParameters };
