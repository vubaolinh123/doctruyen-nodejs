const express = require('express');
const router = express.Router();
const controller = require('../controllers/bookmark');
const { authenticateToken } = require('../middleware/auth');

// Routes công khai
router.get('/', controller.getAll);

// Routes đặc biệt (phải đặt trước route động /:id)
router.get('/customer/:customerId', authenticateToken, controller.getBookmarksByCustomer);
router.get('/customer/:customerId/story/:storyId', authenticateToken, controller.getBookmarkByCustomerAndStory);
router.post('/upsert', authenticateToken, controller.upsertBookmark);
router.delete('/customer/:customerId/all', authenticateToken, controller.removeAllBookmarksByCustomer);

// Routes động (đặt sau routes cụ thể)
router.get('/:id', controller.getById);

// Routes yêu cầu xác thực
router.post('/', authenticateToken, controller.create);
router.put('/:id', authenticateToken, controller.update);
router.delete('/:id', authenticateToken, controller.remove);

module.exports = router;