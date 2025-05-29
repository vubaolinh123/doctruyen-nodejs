const User = require('../../models/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { TokenBlacklist } = require('../../models/tokenBlacklist');
const { RefreshToken } = require('../../models/refreshToken');
const crypto = require('crypto');
const { DEFAULT_EMAIL_AVATAR, getAvatarUrl } = require('../../constants/avatars');

// Thời gian hết hạn của access token (15 ngày)
const ACCESS_TOKEN_EXPIRY = '15d';
// Thời gian hết hạn của refresh token (15 ngày)
const REFRESH_TOKEN_EXPIRY = 15 * 24 * 60 * 60; // 15 days in seconds

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
      // Thêm slug vào payload để client có thể sử dụng
      slug: user.slug || '',
      // Thêm jti (JWT ID) để có thể vô hiệu hóa token cụ thể
      jti: crypto.randomBytes(16).toString('hex')
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

/**
 * Lấy thông tin user để trả về client
 * @param {Object} user - User model
 * @returns {Object} - Thông tin user
 */
const getUserResponse = (user) => {
  return {
    id: user._id.toString(),
    mongoId: user._id.toString(), // Thêm MongoDB ObjectId để client có thể sử dụng
    name: user.name || "",
    email: user.email || "",
    role: user.role || 'user',
    avatar: getAvatarUrl(user.avatar, user.accountType),
    banner: user.banner || null,
    accountType: user.accountType || 'email',
    gender: user.gender || '',
    birthday: user.birthday || null,
    slug: user.slug || '',
    diem_danh: user.diem_danh || 0,
    coin: user.coin || 0,
    coin_total: user.coin_total || 0,
    coin_spent: user.coin_spent || 0,
    created_at: user.createdAt || null,
    isActive: user.isActive || false,
    email_verified_at: user.email_verified_at || null,
    // Social media information - only nested object, no flat fields
    social: {
      bio: user.social?.bio || '',
      facebook: user.social?.facebook || '',
      twitter: user.social?.twitter || '',
      instagram: user.social?.instagram || '',
      youtube: user.social?.youtube || '',
      website: user.social?.website || ''
    },
    // Attendance summary
    attendance_summary: user.attendance_summary || {
      total_days: 0,
      current_streak: 0,
      longest_streak: 0,
      last_attendance: null
    },
    // Metadata
    metadata: user.metadata || {}
  };
};

/**
 * Đăng ký tài khoản mới
 * @param {Object} userData - Dữ liệu người dùng
 * @returns {Promise<Object>} - Kết quả đăng ký
 */
const register = async (userData) => {
  const { email, password, name } = userData;

  // Validate input
  if (!email || !password) {
    throw new Error('EMAIL_PASSWORD_REQUIRED');
  }

  // Kiểm tra email hợp lệ
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('INVALID_EMAIL');
  }

  // Kiểm tra mật khẩu mạnh
  if (password.length < 8) {
    throw new Error('WEAK_PASSWORD');
  }

  // Kiểm tra độ dài tên người dùng
  if (name && name.length > 20) {
    throw new Error('NAME_TOO_LONG');
  }

  // Kiểm tra email đã tồn tại chưa
  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }

  // Hash mật khẩu
  const hashed = await bcrypt.hash(password, 12);

  // Tạo tài khoản mới
  const user = new User({
    email,
    password: hashed,
    name: name || email.split('@')[0],
    role: 'user',
    accountType: 'email',
    isActive: true,
    avatar: DEFAULT_EMAIL_AVATAR
  });

  await user.save();

  return {
    code: 'REGISTER_SUCCESS',
    message: 'Đăng ký thành công. Vui lòng đăng nhập để tiếp tục.'
  };
};

/**
 * Đăng nhập
 * @param {Object} credentials - Thông tin đăng nhập
 * @param {Object} clientInfo - Thông tin client
 * @returns {Promise<Object>} - Kết quả đăng nhập
 */
const login = async (credentials, clientInfo) => {
  const { email, password } = credentials;
  const { userAgent, ipAddress } = clientInfo;

  // Validate input
  if (!email || !password) {
    throw new Error('INVALID_INPUT');
  }

  // Tìm user theo email
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Kiểm tra tài khoản có bị vô hiệu hóa không
  if (!user.isActive) {
    throw new Error('ACCOUNT_DISABLED');
  }

  // Kiểm tra mật khẩu
  // Đối với tài khoản Google, không cần kiểm tra mật khẩu
  if (user.accountType !== 'google') {
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('INVALID_CREDENTIALS');
    }
  } else if (user.accountType === 'google' && password) {
    // Nếu là tài khoản Google và có cung cấp mật khẩu, trả về lỗi
    throw new Error('GOOGLE_ACCOUNT');
  }

  // Tạo access token
  const accessToken = generateAccessToken(user);

  // Tạo refresh token
  const refreshToken = await RefreshToken.generateToken(
    user._id,
    userAgent,
    ipAddress,
    REFRESH_TOKEN_EXPIRY
  );

  // Lưu thời gian đăng nhập cuối cùng
  user.last_active = new Date();
  await user.save();

  return {
    code: 'LOGIN_SUCCESS',
    message: 'Đăng nhập thành công',
    accessToken,
    refreshToken: refreshToken.token,
    user: getUserResponse(user)
  };
};

/**
 * Đăng nhập bằng OAuth (Google)
 * @param {Object} oauthData - Dữ liệu OAuth
 * @param {Object} clientInfo - Thông tin client
 * @returns {Promise<Object>} - Kết quả đăng nhập
 */
const oauthLogin = async (oauthData, clientInfo) => {
  const { email, name, avatar, accountType, token: oauthToken, preserve_db_data, googleId } = oauthData;
  const { userAgent, ipAddress } = clientInfo;

  if (!email) {
    throw new Error('MISSING_EMAIL');
  }

  // Luôn tìm kiếm người dùng bằng email, không sử dụng Google ID
  let user = await User.findOne({ email });

  if (!user) {
    // Tạo user mới nếu chưa tồn tại
    user = new User({
      email,
      name,
      avatar,
      accountType: accountType || 'google',
      isActive: true
    });

    // Tạo slug cho tài khoản mới
    if (name) {
      user.slug = await User.generateUniqueSlug(name);
    }

    // Lưu thông tin Google ID vào metadata nếu cần theo dõi (không sử dụng để tìm kiếm)
    if (googleId) {
      user.metadata = user.metadata || {};
      user.metadata.googleId = googleId;
    }
  } else {
    // Cập nhật thông tin cho tài khoản hiện có
    if (preserve_db_data !== 'true') {
      // Nếu không có yêu cầu giữ nguyên dữ liệu, cập nhật các thông tin
      user.name = name || user.name;
      user.avatar = avatar || user.avatar;
    }
    // Cập nhật loại tài khoản
    user.accountType = accountType || user.accountType || 'google';

    // Tạo slug nếu chưa có
    if (!user.slug && user.name) {
      user.slug = await User.generateUniqueSlug(user.name);
    }

    // Cập nhật thông tin Google ID trong metadata nếu cần
    if (googleId) {
      user.metadata = user.metadata || {};
      user.metadata.googleId = googleId;
    }
  }

  // Lưu hoặc cập nhật
  await user.save();

  // Tạo access token
  const accessToken = generateAccessToken(user);

  // Tạo refresh token
  const refreshToken = await RefreshToken.generateToken(
    user._id,
    userAgent,
    ipAddress,
    REFRESH_TOKEN_EXPIRY
  );

  return {
    code: 'LOGIN_SUCCESS',
    message: 'Đăng nhập thành công',
    accessToken,
    refreshToken: refreshToken.token,
    user: getUserResponse(user)
  };
};

/**
 * Làm mới token
 * @param {string} tokenString - Refresh token
 * @param {Object} clientInfo - Thông tin client
 * @returns {Promise<Object>} - Token mới
 */
const refreshUserToken = async (tokenString, clientInfo) => {
  const { userAgent, ipAddress } = clientInfo;

  if (!tokenString) {
    throw new Error('MISSING_TOKEN');
  }

  // Kiểm tra refresh token có tồn tại trong database không
  const refreshTokenDoc = await RefreshToken.findOne({ token: tokenString });
  if (!refreshTokenDoc) {
    throw new Error('INVALID_TOKEN');
  }

  // Kiểm tra token đã hết hạn chưa
  if (refreshTokenDoc.expiresAt < new Date()) {
    await refreshTokenDoc.remove();
    throw new Error('TOKEN_EXPIRED');
  }

  // Tìm user
  const user = await User.findById(refreshTokenDoc.user);
  if (!user) {
    await refreshTokenDoc.remove();
    throw new Error('USER_NOT_FOUND');
  }

  // Kiểm tra tài khoản có bị vô hiệu hóa không
  if (!user.isActive) {
    await refreshTokenDoc.remove();
    throw new Error('ACCOUNT_DISABLED');
  }

  // Tạo token mới
  const accessToken = generateAccessToken(user);

  // Tạo refresh token mới (rotate refresh token)
  const newRefreshToken = await RefreshToken.generateToken(
    user._id,
    userAgent,
    ipAddress,
    REFRESH_TOKEN_EXPIRY
  );

  // Xóa refresh token cũ
  await refreshTokenDoc.remove();

  return {
    code: 'TOKEN_REFRESHED',
    message: 'Token đã được làm mới',
    accessToken,
    refreshToken: newRefreshToken.token,
    user: getUserResponse(user)
  };
};

/**
 * Đăng xuất
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} - Kết quả đăng xuất
 */
const logout = async (accessToken, refreshToken) => {
  if (!accessToken && !refreshToken) {
    throw new Error('MISSING_TOKEN');
  }

  // Tìm thông tin token từ header
  try {
    // Nếu có access token, thêm vào blacklist
    if (accessToken) {
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET, { ignoreExpiration: true });
      const jti = decoded.jti;
      const exp = decoded.exp;

      // Thêm vào blacklist
      const blacklistEntry = new TokenBlacklist({
        token: accessToken,
        jti,
        expiresAt: new Date(exp * 1000), // Convert Unix timestamp to Date
        type: 'access'
      });
      await blacklistEntry.save();
    }

    // Xóa refresh token
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }

    return {
      code: 'LOGOUT_SUCCESS',
      message: 'Đăng xuất thành công'
    };
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      // Token không hợp lệ, không cần đưa vào blacklist
      return {
        code: 'LOGOUT_SUCCESS',
        message: 'Đăng xuất thành công'
      };
    }
    throw err;
  }
};

/**
 * Lấy thông tin người dùng hiện tại
 * @param {string} userId - ID người dùng
 * @returns {Promise<Object>} - Thông tin người dùng
 */
const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  return {
    code: 'GET_PROFILE_SUCCESS',
    user: getUserResponse(user)
  };
};

/**
 * Cập nhật thông tin người dùng
 * @param {string} userId - ID người dùng
 * @param {Object} updateData - Dữ liệu cập nhật
 * @returns {Promise<Object>} - Thông tin người dùng đã cập nhật
 */
const updateUserProfile = async (userId, updateData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  // Cập nhật các trường an toàn
  if (updateData.name !== undefined) user.name = updateData.name;
  if (updateData.avatar !== undefined) user.avatar = updateData.avatar;
  if (updateData.banner !== undefined) user.banner = updateData.banner;
  if (updateData.gender !== undefined) user.gender = updateData.gender;
  if (updateData.birthday !== undefined) user.birthday = updateData.birthday;

  // Khởi tạo social object nếu chưa có, preserving existing data
  if (!user.social) {
    user.social = {
      bio: '',
      facebook: '',
      twitter: '',
      instagram: '',
      youtube: '',
      website: ''
    };
  }

  // Cập nhật thông tin mạng xã hội và bio với validation - PRESERVE EXISTING DATA
  if (updateData.social !== undefined ||
      updateData.bio !== undefined ||
      updateData.facebook !== undefined ||
      updateData.twitter !== undefined ||
      updateData.instagram !== undefined ||
      updateData.youtube !== undefined ||
      updateData.website !== undefined) {

    // Validation cho URLs mạng xã hội
    const validateUrl = (url, platform) => {
      if (!url) return true; // Empty URL is valid

      try {
        const urlObj = new URL(url);

        // Kiểm tra protocol
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error(`INVALID_${platform.toUpperCase()}_URL`);
        }

        // Kiểm tra domain cho từng platform
        switch (platform) {
          case 'facebook':
            if (!urlObj.hostname.includes('facebook.com') && !urlObj.hostname.includes('fb.com')) {
              throw new Error('INVALID_FACEBOOK_URL');
            }
            break;
          case 'twitter':
            if (!urlObj.hostname.includes('twitter.com') && !urlObj.hostname.includes('x.com')) {
              throw new Error('INVALID_TWITTER_URL');
            }
            break;
          case 'instagram':
            if (!urlObj.hostname.includes('instagram.com')) {
              throw new Error('INVALID_INSTAGRAM_URL');
            }
            break;
          case 'youtube':
            if (!urlObj.hostname.includes('youtube.com') && !urlObj.hostname.includes('youtu.be')) {
              throw new Error('INVALID_YOUTUBE_URL');
            }
            break;
        }

        return true;
      } catch (error) {
        if (error.message.startsWith('INVALID_')) {
          throw error;
        }
        throw new Error(`INVALID_${platform.toUpperCase()}_URL`);
      }
    };

    // Xử lý cập nhật từ nested social object - PRESERVE EXISTING DATA
    if (updateData.social) {
      if (updateData.social.bio !== undefined) {
        if (updateData.social.bio.length > 200) {
          throw new Error('BIO_TOO_LONG');
        }
        user.social.bio = updateData.social.bio;
      }

      if (updateData.social.facebook !== undefined) {
        validateUrl(updateData.social.facebook, 'facebook');
        user.social.facebook = updateData.social.facebook;
      }
      if (updateData.social.twitter !== undefined) {
        validateUrl(updateData.social.twitter, 'twitter');
        user.social.twitter = updateData.social.twitter;
      }
      if (updateData.social.instagram !== undefined) {
        validateUrl(updateData.social.instagram, 'instagram');
        user.social.instagram = updateData.social.instagram;
      }
      if (updateData.social.youtube !== undefined) {
        validateUrl(updateData.social.youtube, 'youtube');
        user.social.youtube = updateData.social.youtube;
      }
      if (updateData.social.website !== undefined) {
        if (updateData.social.website && updateData.social.website.trim()) {
          try {
            new URL(updateData.social.website);
          } catch (error) {
            throw new Error('INVALID_WEBSITE_URL');
          }
        }
        user.social.website = updateData.social.website;
      }
    }

    // Xử lý cập nhật từ flat fields (backward compatibility) - PRESERVE EXISTING DATA
    if (updateData.bio !== undefined) {
      if (updateData.bio.length > 200) {
        throw new Error('BIO_TOO_LONG');
      }
      user.social.bio = updateData.bio;
    }
    if (updateData.facebook !== undefined) {
      validateUrl(updateData.facebook, 'facebook');
      user.social.facebook = updateData.facebook;
    }
    if (updateData.twitter !== undefined) {
      validateUrl(updateData.twitter, 'twitter');
      user.social.twitter = updateData.twitter;
    }
    if (updateData.instagram !== undefined) {
      validateUrl(updateData.instagram, 'instagram');
      user.social.instagram = updateData.instagram;
    }
    if (updateData.youtube !== undefined) {
      validateUrl(updateData.youtube, 'youtube');
      user.social.youtube = updateData.youtube;
    }
    if (updateData.website !== undefined) {
      if (updateData.website && updateData.website.trim()) {
        try {
          new URL(updateData.website);
        } catch (error) {
          throw new Error('INVALID_WEBSITE_URL');
        }
      }
      user.social.website = updateData.website;
    }
  }
  if (updateData.password !== undefined && updateData.currentPassword !== undefined) {
    // Kiểm tra nếu là tài khoản Google
    if (user.accountType === 'google') {
      throw new Error('GOOGLE_ACCOUNT');
    }

    // Kiểm tra mật khẩu hiện tại trước khi đổi
    const isValidPassword = await bcrypt.compare(updateData.currentPassword, user.password);

    if (!isValidPassword) {
      throw new Error('INVALID_CURRENT_PASSWORD');
    }

    // Kiểm tra mật khẩu mới an toàn
    if (updateData.password.length < 8) {
      throw new Error('WEAK_PASSWORD');
    }

    // Hash mật khẩu mới
    const newHashedPassword = await bcrypt.hash(updateData.password, 12);
    user.password = newHashedPassword;
  }
  await user.save();

  return {
    code: 'UPDATE_PROFILE_SUCCESS',
    message: 'Cập nhật thông tin thành công',
    user: getUserResponse(user)
  };
};

module.exports = {
  register,
  login,
  oauthLogin,
  refreshUserToken,
  logout,
  getCurrentUser,
  updateUserProfile,
  getUserResponse,
  generateAccessToken
};