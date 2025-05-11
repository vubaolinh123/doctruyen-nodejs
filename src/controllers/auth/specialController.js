const authService = require('../../services/auth/authService');
const User = require('../../models/user');
const jwt = require('jsonwebtoken');

/**
 * Làm mới token
 * @route POST /api/auth/refresh-token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    // Thông tin client cho auth service
    const clientInfo = {
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.connection.remoteAddress
    };

    // Sử dụng authService để xử lý logic làm mới token
    const result = await authService.refreshUserToken(refreshToken, clientInfo);
    
    res.json(result);
  } catch (err) {
    console.error('❌ Refresh token error:', err);

    // Xử lý các lỗi cụ thể
    if (err.message === 'MISSING_TOKEN') {
      return res.status(400).json({
        code: 'MISSING_TOKEN',
        message: 'Refresh token không được để trống'
      });
    } else if (err.message === 'INVALID_TOKEN') {
      return res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Refresh token không hợp lệ'
      });
    } else if (err.message === 'TOKEN_EXPIRED') {
      return res.status(401).json({
        code: 'TOKEN_EXPIRED',
        message: 'Refresh token đã hết hạn'
      });
    } else if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng'
      });
    } else if (err.message === 'ACCOUNT_DISABLED') {
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản đã bị vô hiệu hóa'
      });
    }

    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
};

/**
 * Lấy thông tin người dùng hiện tại
 * @route GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    // Lấy ID user từ middleware auth
    const userId = req.user.id;

    // Sử dụng authService để lấy thông tin người dùng
    const result = await authService.getCurrentUser(userId);
    
    res.json(result);
  } catch (err) {
    console.error('❌ Get profile error:', err);

    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng'
      });
    }

    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
};

/**
 * Cập nhật thông tin người dùng
 * @route POST /api/auth/update-profile
 */
exports.updateProfile = async (req, res) => {
  try {
    // Lấy ID user từ middleware auth
    const userId = req.user.id;

    // Sử dụng authService để cập nhật thông tin
    const result = await authService.updateUserProfile(userId, req.body);
    
    res.json(result);
  } catch (err) {
    console.error('❌ Update profile error:', err);

    // Xử lý các lỗi cụ thể
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng'
      });
    } else if (err.message === 'INVALID_CURRENT_PASSWORD') {
      return res.status(400).json({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Mật khẩu hiện tại không chính xác'
      });
    } else if (err.message === 'WEAK_PASSWORD') {
      return res.status(400).json({
        code: 'WEAK_PASSWORD',
        message: 'Mật khẩu mới phải có ít nhất 8 ký tự'
      });
    }

    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
};

/**
 * Đăng xuất
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    // Lấy token từ header Authorization
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];

    // Lấy refresh token từ body
    const { refreshToken } = req.body;

    // Sử dụng authService để xử lý đăng xuất
    const result = await authService.logout(accessToken, refreshToken);
    
    res.json(result);
  } catch (err) {
    console.error('❌ Logout error:', err);

    if (err.message === 'MISSING_TOKEN') {
      return res.status(400).json({
        code: 'MISSING_TOKEN',
        message: 'Token không được để trống'
      });
    }

    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
};

/**
 * Tạo token admin dựa trên email
 * @route POST /api/auth/token
 */
exports.generateAdminToken = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email không được để trống'
      });
    }
    
    // Tìm user với email và role là admin
    const admin = await User.findOne({ email, role: 'admin' });
    
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
}; 