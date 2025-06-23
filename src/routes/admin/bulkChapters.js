const express = require('express');
const router = express.Router();
const bulkChapterController = require('../../controllers/admin/bulkChapterController');
const { authenticateToken } = require('../../middleware/auth.middleware');
const logRequest = require('../../middleware/requestLogger');

// Áp dụng middleware log request cho tất cả các route
router.use(logRequest);

// Áp dụng middleware xác thực cho tất cả các route
router.use(authenticateToken);

/**
 * @route POST /api/admin/chapters/bulk-update
 * @desc Cập nhật hàng loạt chapters
 * @access Private (Admin only)
 * @body { 
 *   storyId?: string, 
 *   chapterIds?: string[], 
 *   updateData: { isPaid?: boolean, price?: number, status?: boolean, show_ads?: boolean, is_new?: boolean }
 * }
 */
router.post('/bulk-update', bulkChapterController.bulkUpdateChapters);

/**
 * @route POST /api/admin/chapters/convert-to-paid
 * @desc Chuyển đổi chapters sang trả phí
 * @access Private (Admin only)
 * @body { storyId?: string, chapterIds?: string[], price: number }
 */
router.post('/convert-to-paid', bulkChapterController.convertToPaid);

/**
 * @route POST /api/admin/chapters/convert-to-free
 * @desc Chuyển đổi chapters sang miễn phí
 * @access Private (Admin only)
 * @body { storyId?: string, chapterIds?: string[] }
 */
router.post('/convert-to-free', bulkChapterController.convertToFree);

/**
 * @route GET /api/admin/chapters/stats/:storyId
 * @desc Lấy thống kê chapters theo story
 * @access Private (Admin only)
 * @param { storyId: string }
 */
router.get('/stats/:storyId', bulkChapterController.getChapterStats);

/**
 * @route GET /api/admin/chapters/pricing/:storyId
 * @desc Lấy danh sách chapters với thông tin pricing
 * @access Private (Admin only)
 * @param { storyId: string }
 * @query { page?: number, limit?: number, isPaid?: boolean, sort?: string }
 */
router.get('/pricing/:storyId', bulkChapterController.getChaptersWithPricing);

module.exports = router;
