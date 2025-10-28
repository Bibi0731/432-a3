console.log("🟡 Cache system disabled (no Memcached connection).");

module.exports = {
    async get() { return null; },
    async set() { },
    async delete() { }
};