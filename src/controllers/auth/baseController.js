const authService = require('../../services/auth/authService');

/**
 * Đăng ký tài khoản mới
 * @route POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    // Sử dụng authService để xử lý logic đăng ký
    const result = await authService.register(req.body);

    // Trả về thông báo thành công
    res.status(201).json(result);
  } catch (err) {
    console.error('Register error:', err);

    // Xử lý các lỗi cụ thể
    if (err.message === 'EMAIL_PASSWORD_REQUIRED') {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Email và mật khẩu là bắt buộc'
      });
    } else if (err.message === 'INVALID_EMAIL') {
      return res.status(400).json({
        code: 'INVALID_EMAIL',
        message: 'Email không hợp lệ'
      });
    } else if (err.message === 'WEAK_PASSWORD') {
      return res.status(400).json({
        code: 'WEAK_PASSWORD',
        message: 'Mật khẩu phải có ít nhất 8 ký tự'
      });
    } else if (err.message === 'NAME_TOO_LONG') {
      return res.status(400).json({
        code: 'NAME_TOO_LONG',
        message: 'Tên người dùng không được vượt quá 20 ký tự'
      });
    } else if (err.message === 'EMAIL_EXISTS') {
      return res.status(400).json({
        code: 'EMAIL_EXISTS',
        message: 'Email đã tồn tại trong hệ thống'
      });
    }

    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
};

/**
 * Đăng nhập
 * @route POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    // Thông tin client cho auth service
    const clientInfo = {
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.connection.remoteAddress
    };

    // Sử dụng authService để xử lý logic đăng nhập
    const result = await authService.login(req.body, clientInfo);
    
    console.log('✅ Login success for:', req.body.email);
    res.json(result);
  } catch (err) {
    console.error('❌ Login error:', err);

    // Xử lý các lỗi cụ thể
    if (err.message === 'INVALID_INPUT') {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Email và mật khẩu là bắt buộc'
      });
    } else if (err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Thông tin đăng nhập không chính xác'
      });
    } else if (err.message === 'ACCOUNT_DISABLED') {
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản đã bị vô hiệu hóa'
      });
    } else if (err.message === 'GOOGLE_ACCOUNT') {
      return res.status(400).json({
        code: 'GOOGLE_ACCOUNT',
        message: 'Đây là tài khoản Google, vui lòng đăng nhập bằng Google'
      });
    }

    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
};

/**
 * Đăng nhập bằng OAuth
 * @route POST /api/auth/oauth-login
 */
exports.oath = async (req, res) => {
  try {
    // Thông tin client cho auth service
    const clientInfo = {
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.connection.remoteAddress
    };

    // Sử dụng authService để xử lý logic đăng nhập OAuth
    const result = await authService.oauthLogin(req.body, clientInfo);
    
    res.json(result);
  } catch (err) {
    console.error('❌ OAuth login error:', err);

    if (err.message === 'MISSING_EMAIL') {
      return res.status(400).json({
        code: 'MISSING_EMAIL',
        message: 'Email là bắt buộc'
      });
    }

    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
}; 