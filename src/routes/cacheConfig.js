const express = require('express');
const router = express.Router();
const controller = require('../controllers/cacheConfig');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth.middleware');

// Lấy cấu hình cache (công khai)
router.get('/', controller.getCacheConfig);

// Cập nhật cấu hình cache (chỉ admin)
router.put('/', auth, requireAdmin, controller.updateCacheConfig);

// Xóa cache (chỉ admin)
router.post('/clear', auth, requireAdmin, controller.clearCache);

module.exports = router;
