const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user');
const adminController = require('../../controllers/user/adminController');
const specialController = require('../../controllers/user/specialController');
const permissionController = require('../../controllers/user/permissionController');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

// Áp dụng middleware xác thực cho tất cả các route
router.use(authenticateToken);

// Route tìm kiếm người dùng - Không yêu cầu quyền admin
router.get('/search', specialController.searchUsers);

// Áp dụng middleware kiểm tra quyền admin cho các route còn lại
router.use(isAdmin);

// Route lấy thống kê người dùng
router.get('/stats', adminController.getUserStats);

// Route lấy danh sách người dùng với phân trang và bộ lọc
router.get('/', adminController.getAllUsersAdmin);

// Route lấy thông tin xu của người dùng
router.get('/:id/coins', specialController.getUserCoins);

// Route lấy thông tin preview về dữ liệu sẽ bị xóa
router.get('/:id/deletion-preview', adminController.getUserDeletionPreview);

// Bulk operations routes - MUST be defined BEFORE individual routes to prevent conflicts
router.post('/bulk', adminController.bulkUserOperations);
router.delete('/bulk', adminController.bulkDeleteUsers);

// Individual user operations
router.get('/:id', userController.getById);
router.put('/:id', userController.update);
router.delete('/:id', adminController.deleteUser);

// User status and role management
router.put('/:id/status', adminController.updateUserStatus);
router.put('/:id/role', adminController.updateUserRole);

// Route lấy danh sách quyền của người dùng
router.get('/:id/permissions', permissionController.getUserPermissions);

// Route cập nhật quyền của người dùng
router.post('/:id/permissions', permissionController.addPermission);

module.exports = router;
