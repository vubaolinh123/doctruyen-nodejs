/**
 * Admin Reported Comments Routes
 * Routes cho quản lý bình luận bị báo cáo
 */

const express = require('express');
const router = express.Router();

// Import middleware
const { authenticateToken, isAdmin } = require('../../middleware/auth');

// Import controller
const reportedController = require('../../controllers/comment/reportedController');

/**
 * @swagger
 * tags:
 *   name: Admin Reported Comments
 *   description: API quản lý bình luận bị báo cáo
 */

/**
 * @swagger
 * /api/admin/comments/reported:
 *   get:
 *     summary: Lấy danh sách bình luận bị báo cáo
 *     tags: [Admin Reported Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số lượng item mỗi trang
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo nội dung, tên user, tên truyện
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, resolved, dismissed, escalated]
 *           default: all
 *         description: Lọc theo trạng thái xử lý
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [all, low, medium, high, critical]
 *           default: all
 *         description: Lọc theo mức độ nghiêm trọng
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *           enum: [all, spam, inappropriate, harassment, off-topic, violence, hate-speech, misinformation, copyright, other]
 *           default: all
 *         description: Lọc theo lý do báo cáo
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, story, chapter]
 *           default: all
 *         description: Lọc theo loại bình luận
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, severity, reports]
 *           default: newest
 *         description: Sắp xếp theo
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Hướng sắp xếp
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Lọc từ ngày
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Lọc đến ngày
 *     responses:
 *       200:
 *         description: Danh sách bình luận bị báo cáo
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.get('/',
  authenticateToken,
  isAdmin,
  reportedController.getReportedComments
);

/**
 * @swagger
 * /api/admin/comments/reported/stats:
 *   get:
 *     summary: Lấy thống kê bình luận bị báo cáo
 *     tags: [Admin Reported Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1d, 7d, 30d]
 *           default: 7d
 *         description: Khoảng thời gian thống kê
 *     responses:
 *       200:
 *         description: Thống kê bình luận bị báo cáo
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.get('/stats',
  authenticateToken,
  isAdmin,
  reportedController.getReportedStats
);

/**
 * @swagger
 * /api/admin/comments/reported/{commentId}/resolve:
 *   post:
 *     summary: Giải quyết báo cáo bình luận
 *     tags: [Admin Reported Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của bình luận
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [none, warning, content-hidden, content-deleted, user-suspended, user-banned]
 *                 default: none
 *                 description: Hành động thực hiện
 *               reason:
 *                 type: string
 *                 description: Lý do giải quyết
 *               adminNotes:
 *                 type: string
 *                 description: Ghi chú của admin
 *     responses:
 *       200:
 *         description: Báo cáo đã được giải quyết
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy bình luận
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.post('/:commentId/resolve',
  authenticateToken,
  isAdmin,
  reportedController.resolveReport
);

/**
 * @swagger
 * /api/admin/comments/reported/{commentId}/dismiss:
 *   delete:
 *     summary: Bỏ qua báo cáo bình luận
 *     tags: [Admin Reported Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của bình luận
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do bỏ qua
 *     responses:
 *       200:
 *         description: Báo cáo đã được bỏ qua
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy bình luận
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.delete('/:commentId/dismiss',
  authenticateToken,
  isAdmin,
  reportedController.dismissReport
);



/**
 * @swagger
 * /api/admin/comments/reported/bulk-action:
 *   post:
 *     summary: Xử lý hàng loạt báo cáo
 *     tags: [Admin Reported Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - commentIds
 *               - action
 *             properties:
 *               commentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Danh sách ID bình luận
 *               action:
 *                 type: string
 *                 enum: [resolve, dismiss]
 *                 description: Hành động thực hiện
 *               actionType:
 *                 type: string
 *                 enum: [none, warning, content-hidden, content-deleted, user-suspended, user-banned]
 *                 description: Loại hành động (cho resolve)
 *               reason:
 *                 type: string
 *                 description: Lý do thực hiện hành động
 *     responses:
 *       200:
 *         description: Xử lý hàng loạt thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.post('/bulk-action',
  authenticateToken,
  isAdmin,
  reportedController.bulkAction
);

// Test endpoint to create sample report (development only)
router.post('/create-sample',
  reportedController.createSampleReport
);

module.exports = router;
