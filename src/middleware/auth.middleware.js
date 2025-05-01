const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const { TokenBlacklist } = require('../models/TokenBlacklist');

/**
 * Middleware xác thực JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.authenticateToken = async (req, res, next) => {
  try {
    console.log('Authenticating request to:', req.method, req.originalUrl);
    const authHeader = req.headers.authorization;
    console.log('Auth header:', authHeader ? `${authHeader.substring(0, 35)}...` : 'undefined');

    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No Bearer token found in Authorization header');
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Không có token xác thực'
      });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token received:', token ? `${token.substring(0, 15)}...` : 'undefined', 'length:', token?.length);

    if (!token) {
      console.log('Token is empty after split');
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Token không hợp lệ'
      });
    }

    // Kiểm tra token có trong blacklist không
    const isBlacklisted = await TokenBlacklist.findOne({ token });
    if (isBlacklisted) {
      console.log('Token is blacklisted');
      return res.status(401).json({
        code: 'TOKEN_BLACKLISTED',
        message: 'Token đã hết hạn hoặc bị vô hiệu hóa'
      });
    }

    // Xác thực token
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'exists' : 'missing');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'undefined'
      });
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.name, jwtError.message);
      throw jwtError;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kiểm tra user có tồn tại không
    const customer = await Customer.findById(decoded.id);
    console.log('Customer found:', customer ? 'yes' : 'no');
    if (!customer) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại'
      });
    }

    // Kiểm tra user có bị vô hiệu hóa không
    if (!customer.isActive) {
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản đã bị vô hiệu hóa'
      });
    }

    // Lấy thông tin mới nhất từ database
    const freshCustomer = await Customer.findById(customer._id);
    if (!freshCustomer) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng'
      });
    }

    // Lưu đầy đủ thông tin user mới nhất vào request
    req.user = {
      id: freshCustomer._id,
      email: freshCustomer.email,
      role: freshCustomer.role,
      name: freshCustomer.name,
      // Thêm các trường khác
      avatar: freshCustomer.avatar,
      gender: freshCustomer.gender,
      birthday: freshCustomer.birthday,
      accountType: freshCustomer.accountType,
      diem_danh: freshCustomer.diem_danh,
      coin: freshCustomer.coin,
      coin_total: freshCustomer.coin_total,
      isActive: freshCustomer.isActive,
      email_verified_at: freshCustomer.email_verified_at
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 'TOKEN_EXPIRED',
        message: 'Token đã hết hạn'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Token không hợp lệ'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ'
    });
  }
};

/**
 * Middleware kiểm tra quyền admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Không có thông tin xác thực'
    });
  }

  // Kiểm tra quyền admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Bạn không có quyền truy cập'
    });
  }

  next();
};

/**
 * Middleware kiểm tra quyền theo role
 * @param {Array} roles - Mảng các role được phép truy cập
 */
exports.requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Không có thông tin xác thực'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền truy cập'
      });
    }

    next();
  };
};

/**
 * Middleware kiểm tra quyền sở hữu tài nguyên
 * @param {Function} getResourceOwnerId - Hàm lấy ID chủ sở hữu của tài nguyên
 */
exports.requireOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Không có thông tin xác thực'
        });
      }

      // Admin luôn có quyền truy cập
      if (req.user.role === 'admin') {
        return next();
      }

      const ownerId = await getResourceOwnerId(req);

      // Kiểm tra xem user có phải là chủ sở hữu không
      if (ownerId && ownerId.toString() === req.user.id.toString()) {
        return next();
      }

      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền truy cập tài nguyên này'
      });
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        code: 'SERVER_ERROR',
        message: 'Lỗi máy chủ'
      });
    }
  };
};
