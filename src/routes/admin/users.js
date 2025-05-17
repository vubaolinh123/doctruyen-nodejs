const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user');
const specialController = require('../../controllers/user/specialController');
const permissionController = require('../../controllers/user/permissionController');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

// Áp dụng middleware xác thực và kiểm tra quyền admin cho tất cả các route
router.use(authenticateToken);
router.use(isAdmin);

// Route tìm kiếm người dùng
router.get('/search', specialController.searchUsers);

// Route lấy thông tin xu của người dùng
router.get('/:id/coins', specialController.getUserCoins);

// Route lấy danh sách quyền của người dùng
router.get('/:id/permissions', permissionController.getUserPermissions);

// Route cập nhật quyền của người dùng
router.post('/:id/permissions', permissionController.addPermission);

module.exports = router;
