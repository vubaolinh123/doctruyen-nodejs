const Customer = require('../models/Customer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { TokenBlacklist } = require('../models/TokenBlacklist');
const { RefreshToken } = require('../models/RefreshToken');
const crypto = require('crypto');

// Thời gian hết hạn của access token (15 phút)
const ACCESS_TOKEN_EXPIRY = '15d';
// Thời gian hết hạn của refresh token (30 ngày)
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Tạo access token mới
 * @param {Object} user - Thông tin user
 * @returns {string} - JWT token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      // Thêm jti (JWT ID) để có thể vô hiệu hóa token cụ thể
      jti: crypto.randomBytes(16).toString('hex')
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

/**
 * Lấy thông tin user để trả về client
 * @param {Object} customer - Customer model
 * @returns {Object} - Thông tin user
 */
const getUserResponse = (customer) => {
  return {
    id: customer._id.toString(),
    name: customer.name || "",
    email: customer.email || "",
    role: customer.role || 'user',
    avatar: customer.avatar || "https://scontent.fhan14-1.fna.fbcdn.net/v/t1.30497-1/453178253_471506465671661_2781666950760530985_n.png?stp=dst-png_s200x200&_nc_cat=1&ccb=1-7&_nc_sid=136b72&_nc_eui2=AeEVh0QX00TsNbI_haYB6RkWWt9TLzuBU1Ba31MvO4FTUF6Wlqf82r4BlCRAvh76aT3XsemaZbZv1fSB6o0CuFyz&_nc_ohc=Py8_nbWK5EEQ7kNvwGsqdUg&_nc_oc=AdnI1l-iLBtmCS_HEGsSqRjBSwsEa7c2UqgE5xPauCK2NBbd3kafOH_SABtbbISIdl6NeB79axebfe0e8MZgqmPe&_nc_zt=24&_nc_ht=scontent.fhan14-1.fna&oh=00_AfEDQng6NcDapZJFJ_Rjx-l97NT-NKumwkUgVLnP-cH5Fg&oe=683150FA",
    accountType: customer.accountType || 'email',
    gender: customer.gender || '',
    birthday: customer.birthday || null,
    slug: customer.slug || '',
    diem_danh: customer.diem_danh || 0,
    coin: customer.coin || 0,
    coin_total: customer.coin_total || 0,
    coin_spent: customer.coin_spent || 0,
    created_at: customer.createdAt || null,
    isActive: customer.isActive || false,
    email_verified_at: customer.email_verified_at || null
  };
};

/**
 * Đăng ký tài khoản mới
 * @route POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    // Validate input
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Email và mật khẩu là bắt buộc'
      });
    }

    // Kiểm tra email hợp lệ
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        code: 'INVALID_EMAIL',
        message: 'Email không hợp lệ'
      });
    }

    // Kiểm tra mật khẩu mạnh
    if (password.length < 8) {
      return res.status(400).json({
        code: 'WEAK_PASSWORD',
        message: 'Mật khẩu phải có ít nhất 8 ký tự'
      });
    }

    // Kiểm tra độ dài tên người dùng
    if (name && name.length > 20) {
      return res.status(400).json({
        code: 'NAME_TOO_LONG',
        message: 'Tên người dùng không được vượt quá 20 ký tự'
      });
    }

    // Kiểm tra email đã tồn tại chưa
    const existing = await Customer.findOne({ email });
    if (existing) {
      return res.status(400).json({
        code: 'EMAIL_EXISTS',
        message: 'Email đã tồn tại trong hệ thống'
      });
    }

    // Hash mật khẩu
    const hashed = await bcrypt.hash(password, 12); // Tăng số vòng lặp lên 12 để tăng độ bảo mật

    // Tạo tài khoản mới
    const customer = new Customer({
      email,
      password: hashed,
      name: name || email.split('@')[0], // Nếu không có tên, lấy phần trước @ của email
      role: 'user', // User thường
      accountType: 'email',
      isActive: true
    });

    await customer.save();

    // Trả về thông báo thành công
    res.status(201).json({
      code: 'REGISTER_SUCCESS',
      message: 'Đăng ký thành công. Vui lòng đăng nhập để tiếp tục.'
    });
  } catch (err) {
    console.error('Register error:', err);
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
    // Validate input
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Email và mật khẩu là bắt buộc'
      });
    }

    // Tìm user theo email
    const customer = await Customer.findOne({ email });
    if (!customer) {
      // Không trả về thông báo cụ thể để tránh enumeration attacks
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Thông tin đăng nhập không chính xác'
      });
    }

    // Kiểm tra tài khoản có bị vô hiệu hóa không
    if (!customer.isActive) {
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản đã bị vô hiệu hóa'
      });
    }

    // Kiểm tra mật khẩu
    // Đối với tài khoản Google, không cần kiểm tra mật khẩu
    if (customer.accountType !== 'google') {
      const isValidPassword = await bcrypt.compare(password, customer.password);
      if (!isValidPassword) {
        // Không trả về thông báo cụ thể để tránh enumeration attacks
        return res.status(401).json({
          code: 'INVALID_CREDENTIALS',
          message: 'Thông tin đăng nhập không chính xác'
        });
      }
    } else if (customer.accountType === 'google' && password) {
      // Nếu là tài khoản Google và có cung cấp mật khẩu, trả về lỗi
      return res.status(400).json({
        code: 'GOOGLE_ACCOUNT',
        message: 'Đây là tài khoản Google, vui lòng đăng nhập bằng Google'
      });
    }

    // Tạo access token
    const accessToken = generateAccessToken(customer);

    // Tạo refresh token
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const refreshToken = await RefreshToken.generateToken(
      customer._id,
      userAgent,
      ipAddress,
      REFRESH_TOKEN_EXPIRY
    );

    // Lưu thời gian đăng nhập cuối cùng
    customer.last_active = new Date();
    await customer.save();

    // Trả về thông tin
    const response = {
      code: 'LOGIN_SUCCESS',
      message: 'Đăng nhập thành công',
      accessToken,
      refreshToken: refreshToken.token,
      user: getUserResponse(customer)
    };

    console.log('✅ Login success for:', customer.email);
    res.json(response);
  } catch (err) {
    console.error('❌ Login error:', err);
    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
};


/**
 * Đăng nhập bằng OAuth (Google)
 * @route POST /api/auth/google-callback
 */
exports.oath = async (req, res) => {
  try {
    const { email, name, avatar, accountType, token: oauthToken, preserve_db_data } = req.body;

    if (!email) {
      return res.status(400).json({
        code: 'MISSING_EMAIL',
        message: 'Email là bắt buộc'
      });
    }

    let customer = await Customer.findOne({ email });
    if (!customer) {
      // Tạo customer mới nếu chưa tồn tại
      customer = new Customer({
        email,
        name,
        avatar,
        accountType: accountType || 'google',
        isActive: true,
        email_verified_at: new Date() // Tài khoản Google đã được xác thực email
      });
      await customer.save();
      console.log('Created new Google account:', email);
    } else {
      // Cập nhật thông tin nếu đã tồn tại
      // Kiểm tra nếu có flag preserve_db_data thì không ghi đè thông tin đã cập nhật
      const shouldPreserveData = preserve_db_data === true;
      console.log('Preserve DB data flag:', shouldPreserveData);

      // Chỉ cập nhật name và avatar nếu không có flag preserve_db_data
      if (!shouldPreserveData) {
        if (name) customer.name = name;
        if (avatar) customer.avatar = avatar;
      } else {
        console.log('Preserving existing user data from database for:', email);
      }

      // Luôn cập nhật accountType để đảm bảo đúng loại tài khoản
      if (accountType) customer.accountType = accountType;

      // Cập nhật thời gian hoạt động
      customer.last_active = new Date();
      await customer.save();
    }

    // Tạo access token
    const accessToken = generateAccessToken(customer);

    // Tạo refresh token
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const refreshToken = await RefreshToken.generateToken(
      customer._id,
      userAgent,
      ipAddress,
      REFRESH_TOKEN_EXPIRY
    );

    // Trả về thông tin user và token
    res.json({
      code: 'OAUTH_SUCCESS',
      message: 'Đăng nhập thành công',
      token: accessToken, // Giữ tên token để tương thích với code cũ
      accessToken,
      refreshToken: refreshToken.token,
      user: getUserResponse(customer)
    });
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
};

/**
 * Làm mới access token bằng refresh token
 * @route POST /api/auth/refresh-token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token là bắt buộc'
      });
    }

    // Tìm refresh token trong database
    const foundToken = await RefreshToken.findOne({
      token: refreshToken,
      status: 'active'
    });

    if (!foundToken) {
      return res.status(401).json({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token không hợp lệ hoặc đã hết hạn'
      });
    }

    // Kiểm tra thời gian hết hạn
    if (foundToken.expiresAt < new Date()) {
      // Vô hiệu hóa token
      await foundToken.revoke();

      return res.status(401).json({
        code: 'EXPIRED_REFRESH_TOKEN',
        message: 'Refresh token đã hết hạn'
      });
    }

    // Tìm user
    const customer = await Customer.findById(foundToken.userId);
    if (!customer) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng'
      });
    }

    // Kiểm tra tài khoản có bị vô hiệu hóa không
    if (!customer.isActive) {
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản đã bị vô hiệu hóa'
      });
    }

    // Tạo access token mới
    const accessToken = generateAccessToken(customer);

    // Cập nhật thời gian hoạt động
    customer.last_active = new Date();
    await customer.save();

    res.json({
      code: 'TOKEN_REFRESHED',
      message: 'Token đã được làm mới',
      accessToken
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({
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
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;

    // Nếu có refresh token, vô hiệu hóa nó
    if (refreshToken) {
      const foundToken = await RefreshToken.findOne({ token: refreshToken });
      if (foundToken) {
        await foundToken.revoke();
      }
    }

    // Nếu có access token, thêm vào blacklist
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.split(' ')[1];

      try {
        // Giải mã token để lấy thời gian hết hạn
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET, { ignoreExpiration: true });

        // Tính thời gian hết hạn
        const expiresAt = new Date(decoded.exp * 1000);

        // Thêm vào blacklist
        await TokenBlacklist.create({
          token: accessToken,
          expiresAt,
          reason: 'LOGOUT'
        });
      } catch (error) {
        console.error('Error decoding token during logout:', error);
      }
    }

    res.json({
      code: 'LOGOUT_SUCCESS',
      message: 'Đăng xuất thành công'
    });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({
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
    // req.user đã được set bởi middleware authenticateToken
    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng'
      });
    }

    // Cập nhật thời gian hoạt động
    customer.last_active = new Date();
    await customer.save();

    // Trả về thông tin người dùng
    res.json({
      code: 'SUCCESS',
      user: getUserResponse(customer)
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({
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
    // Lấy thông tin từ request body
    const { name, avatar, banner, gender, birthday, currentPassword, newPassword } = req.body;

    // Tìm người dùng
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng'
      });
    }

    // Kiểm tra độ dài tên người dùng
    if (name && name.length > 20) {
      return res.status(400).json({
        code: 'NAME_TOO_LONG',
        message: 'Tên người dùng không được vượt quá 20 ký tự'
      });
    }

    // Cập nhật thông tin cơ bản
    const updateData = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;
    if (banner) updateData.banner = banner;
    if (gender) updateData.gender = gender;
    if (birthday) updateData.birthday = new Date(birthday);

    // Nếu người dùng muốn đổi mật khẩu
    if (newPassword && currentPassword) {
      // Chỉ cho phép đổi mật khẩu với tài khoản thường (không phải Google)
      if (customer.accountType === 'google') {
        return res.status(400).json({
          code: 'GOOGLE_ACCOUNT',
          message: 'Tài khoản Google không thể đổi mật khẩu'
        });
      }

      // Kiểm tra mật khẩu hiện tại
      const isValidPassword = await bcrypt.compare(currentPassword, customer.password);
      if (!isValidPassword) {
        return res.status(400).json({
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Mật khẩu hiện tại không chính xác'
        });
      }

      // Kiểm tra mật khẩu mới
      if (newPassword.length < 8) {
        return res.status(400).json({
          code: 'WEAK_PASSWORD',
          message: 'Mật khẩu mới phải có ít nhất 8 ký tự'
        });
      }

      // Hash mật khẩu mới
      updateData.password = await bcrypt.hash(newPassword, 12);

      // Vô hiệu hóa tất cả refresh token hiện tại
      await RefreshToken.revokeAllForUser(customer._id);
    }

    // Cập nhật thời gian hoạt động
    updateData.last_active = new Date();

    // Cập nhật thông tin
    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    );

    // Tạo access token mới
    const accessToken = generateAccessToken(updatedCustomer);

    // Tạo refresh token mới
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const refreshToken = await RefreshToken.generateToken(
      updatedCustomer._id,
      userAgent,
      ipAddress,
      REFRESH_TOKEN_EXPIRY
    );

    // Trả về thông tin đã cập nhật
    res.json({
      code: 'PROFILE_UPDATED',
      message: 'Cập nhật thông tin thành công',
      accessToken,
      refreshToken: refreshToken.token,
      token: accessToken, // Giữ tên token để tương thích với code cũ
      user: getUserResponse(updatedCustomer)
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
};
