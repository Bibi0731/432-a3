// src/utils/pagination.js
const toInt = (v, def) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : def;
};

function getPaging(req, { defaultPageSize = 10, maxPageSize = 100 } = {}) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    let pageSize = parseInt(req.query.pageSize) || defaultPageSize;
    pageSize = Math.min(pageSize, maxPageSize);
    return { page, pageSize };
}

function paginateArray(array, { page, pageSize }) {
    const totalItems = array.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const start = (page - 1) * pageSize;
    const items = array.slice(start, start + pageSize);
    return { items, page, totalPages, totalItems };
}

module.exports = { getPaging, paginateArray };