const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth');
const { authenticateToken } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');
const User = require('../models/user');
const jwt = require('jsonwebtoken');

// Rate limiting để ngăn chặn brute force
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 phút
  max: 100, // Tối đa 10 request trong 15 phút
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Quá nhiều yêu cầu đăng nhập, vui lòng thử lại sau 15 phút'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Log middleware cho routes auth
router.use((req, res, next) => {
  console.log(`🔐 Auth route accessed: ${req.method} ${req.url}`);
  next();
});

// Các route không cần xác thực
router.post('/login', loginLimiter, controller.login);
router.post('/register', controller.register);
router.post('/oauth-login', controller.oath);
router.post('/google-callback', controller.oath);
router.post('/refresh-token', controller.refreshToken);

// Các route cần xác thực
router.get('/me', authenticateToken, controller.getMe);
router.post('/update-profile', authenticateToken, controller.updateProfile);
router.post('/banner-position', authenticateToken, controller.updateBannerPosition);
router.post('/logout', authenticateToken, controller.logout);

/**
 * @route POST /api/auth/token
 * @desc Lấy token mới cho admin dựa trên email
 * @access Public
 */
router.post('/token', controller.generateAdminToken);

module.exports = router;
