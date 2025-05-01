const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auth.middleware');

// Đăng ký các route admin
router.use('/coins', authenticateToken, requireAdmin, require('./coins'));
router.use('/users', authenticateToken, requireAdmin, require('./users'));

module.exports = router;
