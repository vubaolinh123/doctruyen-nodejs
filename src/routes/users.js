const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const specialController = require('../controllers/user/specialController');
const { authenticateToken } = require('../middleware/auth');

// Routes cho public
router.get('/', authenticateToken, userController.getAll);
router.get('/:id', authenticateToken, userController.getById);
router.post('/', authenticateToken, userController.create);
router.put('/:id', authenticateToken, userController.update);
router.delete('/:id', authenticateToken, userController.remove);

// Route lấy thông tin xu của người dùng (cần xác thực)
router.get('/:id/coins', authenticateToken, specialController.getUserCoinsForUser);

// Routes cho admin
router.get('/admin/search', authenticateToken, specialController.searchUsers);
router.get('/admin/:id/coins', authenticateToken, specialController.getUserCoins);

module.exports = router;