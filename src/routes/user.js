const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Cập nhật thông tin profile của người dùng hiện tại
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tên hiển thị của người dùng
 *               avatar:
 *                 type: string
 *                 description: URL avatar của người dùng
 *               banner:
 *                 type: string
 *                 description: URL banner của người dùng
 *               gender:
 *                 type: string
 *                 description: Giới tính của người dùng
 *               birthday:
 *                 type: string
 *                 format: date
 *                 description: Ngày sinh của người dùng
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email của người dùng
 *               facebook:
 *                 type: string
 *                 description: Link Facebook
 *               twitter:
 *                 type: string
 *                 description: Link Twitter
 *               instagram:
 *                 type: string
 *                 description: Link Instagram
 *               youtube:
 *                 type: string
 *                 description: Link YouTube
 *               website:
 *                 type: string
 *                 description: Website cá nhân
 *               bio:
 *                 type: string
 *                 description: Tiểu sử của người dùng
 *     responses:
 *       200:
 *         description: Cập nhật thông tin thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cập nhật thông tin thành công"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.put('/profile', authenticateToken, authController.updateProfile);

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Lấy thông tin profile của người dùng hiện tại
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.get('/profile', authenticateToken, authController.getMe);

module.exports = router;
