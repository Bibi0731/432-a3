// src/controllers/adminController.js
const userModel = require('../models/userModel');
const uploadModel = require('../models/uploadModel');
const outputModel = require('../models/outputModel');
const { getPaging, paginateArray } = require('../utils/pagination');
const path = require('path');
const fse = require('fs-extra');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'data/uploads';
const OUTPUT_DIR = process.env.OUTPUT_DIR || 'data/outputs';

/* ----------------- 用户管理 ----------------- */

exports.getAllUsers = (req, res) => {
    const all = userModel.getAllUsers();
    const paging = getPaging(req, { defaultPageSize: 5, maxPageSize: 100 });

    const result = paginateArray(
        all,
        paging,
        (u) => ({ id: u.id, username: u.username, role: u.role })
    );

    res.json(result); // { meta: {...}, items: [...] }
};

/* ----------------- UPLOAD 管理 ----------------- */

exports.getAllUploads = (req, res) => {
    const all = uploadModel.getAll();
    const paging = getPaging(req, { defaultPageSize: 5, maxPageSize: 100 });
    const result = paginateArray(all, paging);
    res.json(result);
};

exports.deleteUpload = async (req, res) => {
    const id = req.params.id;

    // 先查记录拿到真实 ownerId，避免传 null 导致 'forbidden'
    const rec = uploadModel.getById(id);
    if (!rec) return res.status(404).json({ error: 'Not found' });

    const removed = uploadModel.remove(id, rec.ownerId);
    if (!removed || removed === 'forbidden') {
        return res.status(404).json({ error: 'Not found' });
    }

    // 删除物理文件（容错）
    try {
        if (removed.filename) {
            const fullPath = path.join(process.cwd(), UPLOAD_DIR, removed.filename);
            await fse.remove(fullPath);
        }
    } catch { }

    // 级联清理对应 outputs（含物理文件）
    const related = (outputModel.getAll() || []).filter(
        (o) => String(o.uploadId) === String(id)
    );

    for (const out of related) {
        try {
            if (out.filename) {
                await fse.remove(path.join(process.cwd(), OUTPUT_DIR, out.filename));
            }
        } catch { }
        // 用真实 ownerId 删除
        outputModel.remove(out.id, out.ownerId);
    }

    res.json({
        message: 'Upload deleted by admin',
        deleted: removed,
        outputsDeleted: related.length,
    });
};

/* ----------------- OUTPUT 管理 ----------------- */

exports.getAllOutputs = (req, res) => {
    const all = outputModel.getAll();
    const paging = getPaging(req, { defaultPageSize: 5, maxPageSize: 100 });
    const result = paginateArray(all, paging);
    res.json(result);
};

exports.deleteOutput = async (req, res) => {
    const id = req.params.id;

    // 先查记录拿到真实 ownerId
    const rec = outputModel.getById(id);
    if (!rec) return res.status(404).json({ error: 'Not found' });

    const removed = outputModel.remove(id, rec.ownerId);
    if (!removed || removed === 'forbidden') {
        return res.status(404).json({ error: 'Not found' });
    }

    // 删除物理文件（容错）
    try {
        if (removed.filename) {
            const fullPath = path.join(process.cwd(), OUTPUT_DIR, removed.filename);
            await fse.remove(fullPath);
        }
    } catch { }

    res.json({
        message: 'Output deleted by admin',
        deleted: removed,
    });
};
