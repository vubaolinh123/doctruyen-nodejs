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

// Export middleware mặc định cho các route cũ
module.exports = (req, res, next) => {
  authenticateToken(req, res, next);
};

// Export authenticateToken cho các route mới
module.exports.authenticateToken = authenticateToken;