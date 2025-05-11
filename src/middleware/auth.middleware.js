const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { TokenBlacklist } = require('../models/TokenBlacklist');

/**
 * Middleware xác thực JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Không có token xác thực'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Token không hợp lệ'
      });
    }

    // Kiểm tra token có trong blacklist không
    const isBlacklisted = await TokenBlacklist.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({
        code: 'TOKEN_BLACKLISTED',
        message: 'Token đã hết hạn hoặc bị vô hiệu hóa'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.name, jwtError.message);
      throw jwtError;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kiểm tra user có tồn tại không
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại'
      });
    }

    // Kiểm tra user có bị vô hiệu hóa không
    if (!user.isActive) {
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản đã bị vô hiệu hóa'
      });
    }

    // Lấy thông tin mới nhất từ database
    const freshUser = await User.findById(user._id);
    if (!freshUser) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng'
      });
    }

    // Lưu đầy đủ thông tin user mới nhất vào request
    req.user = {
      id: freshUser._id,
      email: freshUser.email,
      role: freshUser.role,
      name: freshUser.name,
      banner: freshUser.banner,
      // Thêm các trường khác
      avatar: freshUser.avatar,
      gender: freshUser.gender,
      birthday: freshUser.birthday,
      accountType: freshUser.accountType,
      diem_danh: freshUser.diem_danh,
      coin: freshUser.coin,
      coin_total: freshUser.coin_total,
      isActive: freshUser.isActive,
      email_verified_at: freshUser.email_verified_at
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
