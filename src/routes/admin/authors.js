const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../../middleware/auth');
const approvalController = require('../../controllers/author/approvalController');

// Middleware để kiểm tra quyền admin
// Apply middleware to all routes
router.use(authenticateToken);
router.use(isAdmin);

// Lấy danh sách tác giả đang chờ phê duyệt
router.get('/pending', approvalController.getPendingAuthors);

// Phê duyệt đơn đăng ký tác giả
router.post('/:id/approve', approvalController.approveAuthor);

// Từ chối đơn đăng ký tác giả
router.post('/:id/reject', approvalController.rejectAuthor);

// Xóa tác giả (sẽ reset role của user về 'user' nếu có userId)
const authorController = require('../../controllers/author/baseController');
router.delete('/:id', authorController.remove);

module.exports = router;
