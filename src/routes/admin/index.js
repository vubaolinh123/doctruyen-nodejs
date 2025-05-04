const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auth.middleware');

// Đăng ký các route admin
router.use('/coins', authenticateToken, requireAdmin, require('./coins'));
router.use('/users', authenticateToken, requireAdmin, require('./users'));
router.use('/stories', authenticateToken, requireAdmin, require('./stories'));
router.use('/chapters', authenticateToken, requireAdmin, require('./chapters'));

module.exports = router;
