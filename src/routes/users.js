const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const { authenticateToken } = require('../middleware/auth');

// Routes cho admin
router.get('/', authenticateToken, userController.getAll);
router.get('/:id', authenticateToken, userController.getById);
router.post('/', authenticateToken, userController.create);
router.put('/:id', authenticateToken, userController.update);
router.delete('/:id', authenticateToken, userController.remove);

module.exports = router; 