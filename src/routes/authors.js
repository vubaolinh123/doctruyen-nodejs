const express = require('express');
const router = express.Router();
const controller = require('../controllers/author');
const { authenticateToken } = require('../middleware/auth');

// Optional authentication middleware - doesn't fail if no token
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided, continue without user
    return next();
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Invalid token, continue without user
      return next();
    }
    // Valid token, attach user to request
    req.user = user;
    next();
  });
};

// ==========================================================
// CÁC ROUTE CÔNG KHAI (KHÔNG CẦN XÁC THỰC)
// ==========================================================

// Lấy danh sách tác giả
router.get('/', controller.getAll);
router.get('/active', controller.getActive);
router.get('/slug/:slug', controller.getBySlug);
router.get('/:id', controller.getById);

// Lấy yêu cầu đăng ký tác giả (với thông tin tiến độ nếu user đã đăng nhập)
router.get('/eligibility/requirements', optionalAuth, controller.getRequirements);

// ==========================================================
// CÁC ROUTE CẦN XÁC THỰC USER
// ==========================================================

// Kiểm tra điều kiện đăng ký tác giả của user hiện tại
router.get('/eligibility/check', authenticateToken, controller.checkEligibility);

// Lấy thông tin đăng ký tác giả của user hiện tại
router.get('/register/info', authenticateToken, controller.getRegistrationInfo);

// Đăng ký user hiện tại thành tác giả
router.post('/register', authenticateToken, controller.registerAsAuthor);

// ==========================================================
// CÁC ROUTE ADMIN (CẦN XÁC THỰC VÀ QUYỀN ADMIN)
// ==========================================================

// Tạo, cập nhật, xóa tác giả (admin)
router.post('/', authenticateToken, controller.create);
router.put('/:id', authenticateToken, controller.update);
router.delete('/:id', authenticateToken, controller.remove);

// Kiểm tra điều kiện đăng ký tác giả của user cụ thể (admin)
router.get('/eligibility/check/:userId', authenticateToken, controller.checkUserEligibility);

// Thống kê điều kiện đăng ký (admin)
router.get('/eligibility/stats', authenticateToken, controller.getEligibilityStats);

// Lịch sử đăng ký tác giả (admin)
router.get('/register/history', authenticateToken, controller.getRegistrationHistory);

// Thống kê đăng ký tác giả (admin)
router.get('/register/stats', authenticateToken, controller.getRegistrationStats);

// Admin đăng ký user thành tác giả (admin)
router.post('/register/admin/:userId', authenticateToken, controller.adminRegisterUser);

// Xóa author record bị từ chối để cho phép đăng ký lại
router.delete('/rejected/:id', authenticateToken, require('../controllers/author/approvalController').deleteRejectedAuthor);

module.exports = router;