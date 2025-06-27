const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchase/purchaseController');
const { authenticateToken, optionalAuth } = require('../middleware/auth.middleware');
const logRequest = require('../middleware/requestLogger');

// Áp dụng middleware log request cho tất cả các route
router.use(logRequest);

/**
 * @route GET /api/purchase/check-access
 * @desc Kiểm tra quyền truy cập nội dung
 * @access Public (Optional authentication)
 * @query { storyId: string, chapterId?: string }
 */
router.get('/check-access', optionalAuth, purchaseController.checkAccess);

/**
 * @route POST /api/purchase/check-access
 * @desc Kiểm tra quyền truy cập nội dung (POST method for frontend compatibility)
 * @access Public (Optional authentication)
 * @body { userId?: string, storyId: string, chapterId?: string }
 */
router.post('/check-access', optionalAuth, purchaseController.checkAccess);

/**
 * @route POST /api/purchase/story
 * @desc Mua truyện
 * @access Private (Authenticated users)
 * @body { storyId: string }
 */
router.post('/story', authenticateToken, purchaseController.purchaseStory);

/**
 * @route POST /api/purchase/chapter
 * @desc Mua chapter
 * @access Private (Authenticated users)
 * @body { chapterId: string }
 */
router.post('/chapter', authenticateToken, purchaseController.purchaseChapter);

/**
 * @route GET /api/purchase/my-purchases
 * @desc Lấy danh sách purchases của user hiện tại
 * @access Private (Authenticated users)
 */
router.get('/my-purchases', authenticateToken, purchaseController.getMyPurchases);

module.exports = router;
