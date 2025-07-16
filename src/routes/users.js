const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const specialController = require('../controllers/user/specialController');
const permissionController = require('../controllers/user/permissionController');
const { authenticateToken } = require('../middleware/auth');

// Routes cho admin user management (moved to /admin/users)
// router.get('/stats', authenticateToken, userController.getUserStats);
// router.post('/bulk', authenticateToken, userController.bulkUserOperations);
// router.get('/:id/deletion-preview', authenticateToken, userController.getUserDeletionPreview);
// router.delete('/bulk', authenticateToken, userController.bulkDeleteUsers);

// Analytics routes
router.get('/analytics/registration-stats', authenticateToken, userController.getRegistrationStats);
router.get('/analytics/registration-overview', authenticateToken, userController.getRegistrationOverview);
router.get('/analytics/registration-by-type', authenticateToken, userController.getRegistrationByType);
router.get('/analytics/growth-rate', authenticateToken, userController.getGrowthRate);

// Routes cho public
router.get('/', authenticateToken, userController.getAll);
router.get('/:id', authenticateToken, userController.getById);
router.post('/', authenticateToken, userController.create);
router.put('/:id', authenticateToken, userController.update);
router.delete('/:id', authenticateToken, userController.remove);

// Routes cho admin - user status và role management (moved to /admin/users)
// router.put('/:id/status', authenticateToken, userController.updateUserStatus);
// router.put('/:id/role', authenticateToken, userController.updateUserRole);

// Route lấy thông tin xu của người dùng (cần xác thực)
router.get('/:id/coins', authenticateToken, specialController.getUserCoinsForUser);

// Route lấy danh sách quyền của người dùng (cần xác thực)
router.get('/:id/permissions', authenticateToken, permissionController.getUserPermissions);

// Route lấy thống kê toàn diện của người dùng hiện tại (cần xác thực)
router.get('/me/comprehensive-stats', authenticateToken, userController.getUserComprehensiveStats);

// Routes cho admin - Route search chỉ yêu cầu authenticateToken, không yêu cầu isAdmin
router.get('/admin/search', authenticateToken, specialController.searchUsers);

// Routes cho admin - Các route khác yêu cầu cả authenticateToken và isAdmin
router.get('/admin/:id/coins', authenticateToken, specialController.getUserCoins);

// Routes quản lý quyền của người dùng (chỉ admin)
router.post('/admin/:id/permissions', authenticateToken, permissionController.addPermission);
router.put('/admin/:id/permissions/:name', authenticateToken, permissionController.updatePermission);
router.delete('/admin/:id/permissions/:name', authenticateToken, permissionController.removePermission);
router.put('/admin/:id/permissions/:name/activate', authenticateToken, permissionController.activatePermission);
router.put('/admin/:id/permissions/:name/deactivate', authenticateToken, permissionController.deactivatePermission);

module.exports = router;