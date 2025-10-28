// src/routes/admin.js
const express = require('express');
const router = express.Router();

const { authenticate, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// ---- 用户管理 ----
router.get('/users', authenticate, requireAdmin, adminController.getAllUsers);

// ---- Upload 管理 ----
router.get('/uploads', authenticate, requireAdmin, adminController.getAllUploads);
router.delete('/uploads/:id', authenticate, requireAdmin, adminController.deleteUpload);

// ---- Output 管理 ----
router.get('/outputs', authenticate, requireAdmin, adminController.getAllOutputs);
router.delete('/outputs/:id', authenticate, requireAdmin, adminController.deleteOutput);

module.exports = router;
