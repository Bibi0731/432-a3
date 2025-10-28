require("dotenv").config();
const memjs = require("memjs");

const client = memjs.Client.create(`${process.env.MEMCACHED_HOST}:11211`);

async function test() {
    try {
        await client.set("hello", "world", { expires: 60 });
        console.log("Set key: hello = world");

        const { value } = await client.get("hello");
        console.log("Get key: hello =", value.toString());
    } catch (err) {
        console.error("Memcached error:", err);
    } finally {
        client.close();
    }
}

test();
