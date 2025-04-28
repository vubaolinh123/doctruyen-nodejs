const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');

// Rate limiting để ngăn chặn brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 request trong 15 phút
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
router.post('/logout', authenticateToken, controller.logout);

module.exports = router;
