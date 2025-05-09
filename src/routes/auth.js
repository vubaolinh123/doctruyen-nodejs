const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');
const Customer = require('../models/Customer');
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
router.post('/logout', authenticateToken, controller.logout);

/**
 * @route POST /api/auth/token
 * @desc Lấy token mới cho admin dựa trên email
 * @access Public
 */
router.post('/token', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email không được để trống'
      });
    }
    
    // Tìm user với email và role là admin
    const admin = await Customer.findOne({ email, role: 'admin' });
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản admin với email này'
      });
    }
    
    // Tạo token mới cho admin
    const payload = {
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role
    };
    
    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    return res.json({
      success: true,
      accessToken
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
});

module.exports = router;
