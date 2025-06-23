const jwt = require('jsonwebtoken');

// Middleware để xác thực token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Access Denied. No Authorization Header Provided.'
    });
  }

  const token = authHeader.split(' ')[1];
  console.log('[Auth Middleware] Token extracted:', token ? 'Yes' : 'No');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access Denied. No Token Provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // Lưu thông tin người dùng vào req.user
    next();
  } catch (err) {
    console.error('[Auth Middleware] Token verification failed:', err.message);

    // Kiểm tra lỗi cụ thể
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token đã hết hạn'
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format or signature'
      });
    }

    res.status(400).json({
      success: false,
      error: 'Token không hợp lệ: ' + err.message
    });
  }
};

// Middleware để xác thực người dùng đã đăng nhập
const isAuthenticated = (req, res, next) => {
  authenticateToken(req, res, next);
};

// Middleware để kiểm tra quyền admin
const isAdmin = (req, res, next) => {
  // Đảm bảo người dùng đã được xác thực
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Please login first.'
    });
  }

  // Kiểm tra quyền admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden. Admin access required.'
    });
  }

  next();
};

// Export middleware mặc định cho các route cũ
module.exports = (req, res, next) => {
  authenticateToken(req, res, next);
};

// Middleware xác thực tùy chọn - không bắt buộc phải có token
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Nếu không có header hoặc token, vẫn cho phép tiếp tục nhưng không set req.user
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Lưu thông tin người dùng vào req.user nếu token hợp lệ
  } catch (err) {
    // Nếu token không hợp lệ, vẫn cho phép tiếp tục nhưng không set req.user
    console.log('Optional auth token invalid:', err.message);
  }

  next();
};

// Export các middleware
module.exports.authenticateToken = authenticateToken;
module.exports.isAuthenticated = isAuthenticated;
module.exports.isAdmin = isAdmin;
module.exports.requireAdmin = isAdmin; // Alias cho isAdmin
module.exports.optional = optionalAuth;