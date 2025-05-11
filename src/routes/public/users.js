const express = require('express');
const router = express.Router();
const customerController = require('../../controllers/user');
const auth = require('../../middleware/auth');

// Route công khai để lấy thông tin người dùng theo slug
// Middleware auth là optional - nếu có token thì sẽ kiểm tra xem có phải profile của chính họ không
router.get('/slug/:slug', auth.optional, customerController.getBySlug);

// Route công khai chỉ trả về trường slug của người dùng theo ID
router.get('/slug-only/:id', customerController.getSlugById);

module.exports = router;
