const jwt = require('jsonwebtoken');

// Middleware để xác thực token
const authenticateToken = (req, res, next) => {
  console.log('Auth middleware called');

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.error('No Authorization header found');
    return res.status(401).json({
      success: false,
      error: 'Access Denied. No Authorization Header Provided.'
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.error('No token found in Authorization header');
    return res.status(401).json({
      success: false,
      error: 'Access Denied. No Token Provided.'
    });
  }

  console.log('Token found:', token.substring(0, 20) + '...');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Lưu thông tin người dùng vào req.user

    // Log để debug
    console.log('Authenticated user:', {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    });

    next();
  } catch (err) {
    console.error('JWT verification error:', err);

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