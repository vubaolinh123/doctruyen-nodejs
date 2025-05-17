const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const specialController = require('../controllers/user/specialController');
const permissionController = require('../controllers/user/permissionController');
const { authenticateToken } = require('../middleware/auth');

// Routes cho public
router.get('/', authenticateToken, userController.getAll);
router.get('/:id', authenticateToken, userController.getById);
router.post('/', authenticateToken, userController.create);
router.put('/:id', authenticateToken, userController.update);
router.delete('/:id', authenticateToken, userController.remove);

// Route lấy thông tin xu của người dùng (cần xác thực)
router.get('/:id/coins', authenticateToken, specialController.getUserCoinsForUser);

// Route lấy danh sách quyền của người dùng (cần xác thực)
router.get('/:id/permissions', authenticateToken, permissionController.getUserPermissions);

// Routes cho admin
router.get('/admin/search', authenticateToken, specialController.searchUsers);
router.get('/admin/:id/coins', authenticateToken, specialController.getUserCoins);

// Routes quản lý quyền của người dùng (chỉ admin)
router.post('/admin/:id/permissions', authenticateToken, permissionController.addPermission);
router.put('/admin/:id/permissions/:name', authenticateToken, permissionController.updatePermission);
router.delete('/admin/:id/permissions/:name', authenticateToken, permissionController.removePermission);
router.put('/admin/:id/permissions/:name/activate', authenticateToken, permissionController.activatePermission);
router.put('/admin/:id/permissions/:name/deactivate', authenticateToken, permissionController.deactivatePermission);

module.exports = router;