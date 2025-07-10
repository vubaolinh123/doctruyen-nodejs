const User = require('../../models/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { TokenBlacklist } = require('../../models/tokenBlacklist');
const { RefreshToken } = require('../../models/refreshToken');
const crypto = require('crypto');
const { DEFAULT_EMAIL_AVATAR } = require('../../constants/avatars');

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
    avatar: user.avatar || null, // Return full avatar object instead of processed URL
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

  // Tạo tài khoản mới với proper AvatarData object structure
  const user = new User({
    email,
    password: hashed,
    name: name || email.split('@')[0],
    role: 'user',
    accountType: 'email',
    isActive: true,
    avatar: {
      primaryUrl: DEFAULT_EMAIL_AVATAR,
      variants: [],
      googleDriveId: '',
      lastUpdated: new Date(),
      metadata: {
        originalFilename: 'default-avatar.png.webp',
        processedVariants: 0,
        uploadedFiles: 0,
        fileSize: '',
        mimeType: 'image/webp',
        dimensions: { width: 0, height: 0 }
      }
    }
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
 * Xử lý authorization code từ Google OAuth
 * @param {Object} authData - Dữ liệu authorization code
 * @param {Object} clientInfo - Thông tin client
 * @returns {Promise<Object>} - Kết quả đăng nhập
 */
const handleGoogleAuthorizationCode = async (authData, clientInfo) => {
  const { code, redirectUri } = authData;

  if (!code) {
    throw new Error('MISSING_AUTHORIZATION_CODE');
  }

  try {
    const axios = require('axios');

    // Exchange authorization code for access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const tokenData = tokenResponse.data;

    if (!tokenData.access_token) {
      console.error('Google token exchange error:', tokenData);
      throw new Error(`Google token exchange failed: ${tokenData.error_description || tokenData.error || 'No access token received'}`);
    }

    // Get user profile from Google
    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const profile = profileResponse.data;

    if (!profile.email) {
      console.error('Google profile fetch error:', profile);
      throw new Error('Failed to fetch user profile from Google');
    }

    // Process the user profile data using existing OAuth logic
    const oauthUserData = {
      email: profile.email,
      name: profile.name,
      avatar: profile.picture,
      googleId: profile.id,
      provider: 'google',
      accountType: 'google'
    };

    // Call the existing OAuth login logic with profile data
    return await processOAuthUser(oauthUserData, clientInfo);

  } catch (error) {
    console.error('Google OAuth authorization code error:', error);
    throw new Error(`Google OAuth failed: ${error.message}`);
  }
};

/**
 * Đăng nhập bằng OAuth (Google)
 * @param {Object} oauthData - Dữ liệu OAuth
 * @param {Object} clientInfo - Thông tin client
 * @returns {Promise<Object>} - Kết quả đăng nhập
 */
const oauthLogin = async (oauthData, clientInfo) => {
  // Handle authorization code flow
  if (oauthData.code && oauthData.provider === 'google') {
    return await handleGoogleAuthorizationCode(oauthData, clientInfo);
  }

  // Handle direct profile data flow (legacy)
  return await processOAuthUser(oauthData, clientInfo);
};

/**
 * Xử lý thông tin người dùng OAuth
 * @param {Object} oauthData - Dữ liệu OAuth
 * @param {Object} clientInfo - Thông tin client
 * @returns {Promise<Object>} - Kết quả đăng nhập
 */
const processOAuthUser = async (oauthData, clientInfo) => {
  const { email, name, avatar, accountType, token: oauthToken, preserve_db_data, googleId } = oauthData;
  const { userAgent, ipAddress } = clientInfo;

  if (!email) {
    throw new Error('MISSING_EMAIL');
  }

  // Luôn tìm kiếm người dùng bằng email, không sử dụng Google ID
  let user = await User.findOne({ email });

  if (!user) {
    // Tạo user mới nếu chưa tồn tại với proper AvatarData object
    const avatarData = avatar ? {
      primaryUrl: avatar,
      variants: [],
      googleDriveId: '',
      lastUpdated: new Date(),
      metadata: {
        originalFilename: 'google-profile-picture',
        processedVariants: 0,
        uploadedFiles: 1,
        fileSize: '',
        mimeType: 'image/jpeg',
        dimensions: { width: 0, height: 0 }
      }
    } : {
      primaryUrl: DEFAULT_EMAIL_AVATAR,
      variants: [],
      googleDriveId: '',
      lastUpdated: new Date(),
      metadata: {
        originalFilename: 'default-avatar.png.webp',
        processedVariants: 0,
        uploadedFiles: 0,
        fileSize: '',
        mimeType: 'image/webp',
        dimensions: { width: 0, height: 0 }
      }
    };

    user = new User({
      email,
      name,
      avatar: avatarData,
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

      // Update avatar with proper AvatarData object structure
      if (avatar) {
        // If user already has avatar object structure, update primaryUrl
        if (user.avatar && typeof user.avatar === 'object' && user.avatar.primaryUrl !== undefined) {
          user.avatar.primaryUrl = avatar;
          user.avatar.lastUpdated = new Date();
          user.avatar.metadata.originalFilename = 'google-profile-picture';
          user.avatar.metadata.mimeType = 'image/jpeg';
        } else {
          // Convert from legacy string or create new object
          user.avatar = {
            primaryUrl: avatar,
            variants: [],
            googleDriveId: '',
            lastUpdated: new Date(),
            metadata: {
              originalFilename: 'google-profile-picture',
              processedVariants: 0,
              uploadedFiles: 1,
              fileSize: '',
              mimeType: 'image/jpeg',
              dimensions: { width: 0, height: 0 }
            }
          };
        }
      }
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

  // Handle avatar data - convert JSON string to object if needed
  if (updateData.avatar !== undefined) {
    if (typeof updateData.avatar === 'string' && updateData.avatar.startsWith('{')) {
      try {
        // Parse JSON string to object for new schema
        const avatarData = JSON.parse(updateData.avatar);
        user.avatar = {
          primaryUrl: avatarData.primaryUrl || avatarData.avatarUrl || '',
          variants: avatarData.variants || avatarData.sizes || [],
          googleDriveId: avatarData.googleDriveId || '',
          lastUpdated: new Date(),
          metadata: {
            originalFilename: avatarData.metadata?.originalFilename || '',
            processedVariants: avatarData.metadata?.processedVariants || 0,
            uploadedFiles: avatarData.metadata?.uploadedFiles || 0,
            fileSize: avatarData.metadata?.fileSize || '',
            mimeType: avatarData.metadata?.mimeType || '',
            dimensions: avatarData.metadata?.dimensions || { width: 0, height: 0 }
          }
        };
      } catch (e) {
        // If parsing fails, treat as simple URL
        user.avatar = {
          primaryUrl: updateData.avatar,
          variants: [],
          googleDriveId: '',
          lastUpdated: new Date(),
          metadata: {
            originalFilename: '',
            processedVariants: 0,
            uploadedFiles: 0,
            fileSize: '',
            mimeType: '',
            dimensions: { width: 0, height: 0 }
          }
        };
      }
    } else if (typeof updateData.avatar === 'object') {
      // Already an object, store directly
      user.avatar = updateData.avatar;
    } else {
      // Simple string URL
      user.avatar = {
        primaryUrl: updateData.avatar,
        variants: [],
        googleDriveId: '',
        lastUpdated: new Date(),
        metadata: {
          originalFilename: '',
          processedVariants: 0,
          uploadedFiles: 0,
          fileSize: '',
          mimeType: '',
          dimensions: { width: 0, height: 0 }
        }
      };
    }
  }

  // Handle banner data conversion - same logic as avatar
  if (updateData.banner !== undefined) {
    if (typeof updateData.banner === 'string' && updateData.banner.startsWith('{')) {
      try {
        // Parse JSON string to object for new schema
        const bannerData = JSON.parse(updateData.banner);
        user.banner = {
          primaryUrl: bannerData.primaryUrl || bannerData.bannerUrl || '',
          variants: bannerData.variants || bannerData.sizes || [],
          googleDriveId: bannerData.googleDriveId || '',
          lastUpdated: new Date(),
          position: bannerData.position || 0.5,
          containerHeight: bannerData.containerHeight || 450,
          metadata: {
            fileName: bannerData.metadata?.fileName || '',
            size: bannerData.metadata?.size || '',
            mimeType: bannerData.metadata?.mimeType || ''
          }
        };
      } catch (e) {
        // If parsing fails, treat as simple URL
        user.banner = {
          primaryUrl: updateData.banner,
          variants: [],
          googleDriveId: '',
          lastUpdated: new Date(),
          position: 0.5,
          containerHeight: 450,
          metadata: {
            fileName: '',
            size: '',
            mimeType: ''
          }
        };
      }
    } else if (typeof updateData.banner === 'object') {
      // Already an object, store directly
      user.banner = updateData.banner;
    } else {
      // Simple string URL - convert to object schema
      user.banner = {
        primaryUrl: updateData.banner,
        variants: [],
        googleDriveId: '',
        lastUpdated: new Date(),
        position: 0.5,
        containerHeight: 450,
        metadata: {
          fileName: '',
          size: '',
          mimeType: ''
        }
      };
    }
  }
  if (updateData.gender !== undefined) user.gender = updateData.gender;

  // Handle birthday field with proper date conversion
  if (updateData.birthday !== undefined) {
    if (updateData.birthday === '' || updateData.birthday === null) {
      user.birthday = null;
    } else {
      // Ensure birthday is stored as a proper Date object
      try {
        const birthdayDate = new Date(updateData.birthday);
        if (!isNaN(birthdayDate.getTime())) {
          user.birthday = birthdayDate;
        } else {
          console.warn('[AuthService] Invalid birthday format:', updateData.birthday);
        }
      } catch (error) {
        console.warn('[AuthService] Error parsing birthday:', error);
      }
    }
  }

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