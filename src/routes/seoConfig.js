const express = require('express');
const router = express.Router();
const controller = require('../controllers/seoConfig');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth.middleware');

// Lấy cấu hình SEO (công khai)
router.get('/', controller.getSeoConfig);

// Cập nhật cấu hình SEO (tạm thời bỏ yêu cầu xác thực để debug)
router.put('/', controller.updateSeoConfig);

module.exports = router;
