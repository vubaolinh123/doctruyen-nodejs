const express = require('express');
const router = express.Router();
const controller = require('../controllers/cacheConfig');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth.middleware');

// Lấy cấu hình cache (công khai)
router.get('/', controller.getCacheConfig);

// Cập nhật cấu hình cache (chỉ admin)
router.put('/', auth, requireAdmin, controller.updateCacheConfig);

// Thêm route PUT không cần xác thực cho debugging

// Xóa cache (chỉ admin)
router.post('/clear', auth, requireAdmin, controller.clearCache);

// Log các route đã đăng ký
console.log('[Routes] Cache config routes registered:');
console.log('- GET /api/cache-config');
console.log('- PUT /api/cache-config (requires admin)');
if (process.env.NODE_ENV === 'development') {
  console.log('- PUT /api/cache-config/debug (development only)');
}
console.log('- POST /api/cache-config/clear (requires admin)');

module.exports = router;
