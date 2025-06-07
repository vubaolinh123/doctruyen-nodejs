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
    } else if (err.message === 'GOOGLE_ACCOUNT') {
      return res.status(400).json({
        code: 'GOOGLE_ACCOUNT',
        message: 'Tài khoản Google không thể đổi mật khẩu. Vui lòng sử dụng cài đặt bảo mật Google.'
      });
    }

    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Lỗi máy chủ, vui lòng thử lại sau'
    });
  }
};

/**
 * Cập nhật vị trí banner
 * @route POST /api/auth/banner-position
 */
exports.updateBannerPosition = async (req, res) => {
  try {
    // Lấy ID user từ middleware auth
    const userId = req.user.id;
    const { bannerUrl, position, containerHeight, tempId, enhancedPositioning } = req.body;



    // Check if this is a temp-to-Google Drive upload workflow
    if (tempId) {
      return await handleTempToGoogleDriveUpload(req, res, userId, tempId, position, containerHeight);
    }

    // Regular position update workflow
    // Validation
    if (!bannerUrl) {
      return res.status(400).json({
        success: false,
        error: 'Banner URL is required'
      });
    }

    if (typeof position !== 'number' || position < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position value'
      });
    }

    // Tìm user
    const User = require('../../models/user');
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }



    // Cập nhật banner position trong user document
    // Lưu position như metadata cùng với banner URL
    let bannerData;

    if (typeof user.banner === 'object' && user.banner !== null) {
      // Banner đã là object MongoDB, sử dụng trực tiếp
      bannerData = { ...user.banner };
    } else if (typeof user.banner === 'string') {
      try {
        // Thử parse JSON string (legacy format)
        if (user.banner.startsWith('{')) {
          bannerData = JSON.parse(user.banner);
        } else {
          // Banner là URL string đơn giản
          bannerData = { primaryUrl: user.banner };
        }
      } catch (e) {
        // Parse lỗi, treat as URL string
        bannerData = { primaryUrl: user.banner };
      }
    } else {
      // Không có banner hiện tại, sử dụng bannerUrl từ request
      bannerData = { primaryUrl: bannerUrl };
    }

    // Đảm bảo bannerData có cấu trúc đúng
    if (!bannerData.primaryUrl) {
      bannerData.primaryUrl = bannerUrl;
    }



    // Cập nhật position với enhanced positioning metadata
    if (enhancedPositioning) {
      // Create enhanced positioning metadata
      bannerData.positioning = {
        position: position,
        containerHeight: containerHeight || 450,
        containerWidth: enhancedPositioning.containerWidth,
        imageWidth: enhancedPositioning.imageWidth,
        imageHeight: enhancedPositioning.imageHeight,
        aspectRatio: enhancedPositioning.aspectRatio,
        calculatedImageHeight: enhancedPositioning.calculatedImageHeight,
        maxDragDistance: enhancedPositioning.maxDragDistance,
        minOffset: enhancedPositioning.minOffset,
        maxOffset: enhancedPositioning.maxOffset,
        positionedAt: new Date(),
        deviceType: enhancedPositioning.deviceType,
        viewportWidth: enhancedPositioning.viewportWidth,
        viewportHeight: enhancedPositioning.viewportHeight
      };


    }

    // Update legacy fields for backward compatibility
    bannerData.position = position;
    bannerData.containerHeight = containerHeight || 450;
    bannerData.lastUpdated = new Date();

    // Lưu lại vào database (store as proper MongoDB object)
    user.banner = bannerData;
    await user.save();



    res.json({
      success: true,
      message: 'Banner position updated successfully',
      bannerUrl: bannerData.primaryUrl,
      position: position
    });

  } catch (err) {
    console.error('❌ Update banner position error:', err);

    return res.status(500).json({
      success: false,
      error: 'Failed to update banner position'
    });
  }
};

/**
 * Handle temp-to-Google Drive upload workflow
 */
async function handleTempToGoogleDriveUpload(req, res, userId, tempId, position, containerHeight) {
  try {


    // Step 1: Get temp image path
    const { getTempImagePath } = require('../image/tempImageController');
    const tempImagePath = getTempImagePath(tempId);

    if (!tempImagePath) {
      return res.status(404).json({
        success: false,
        error: 'Temporary image not found or expired'
      });
    }

    // Step 2: Upload to Google Drive
    const fs = require('fs').promises;
    const imageBuffer = await fs.readFile(tempImagePath);

    // Use existing upload service
    const { uploadSingleFile } = require('../../utils/image/googleDriveUploader');
    const { getFolderIds } = require('../../config/googleDrive');

    // Get banner folder ID
    const folderIds = getFolderIds();
    const bannerFolderId = folderIds.banner;

    // Upload to Google Drive
    const fileName = `banner_${userId}_${Date.now()}.jpg`;
    const uploadResult = await uploadSingleFile(imageBuffer, fileName, 'image/jpeg', bannerFolderId);



    if (!uploadResult || !uploadResult.publicUrl) {
      throw new Error('Failed to upload to Google Drive - no URL returned');
    }

    // Step 3: Save to database
    const User = require('../../models/user');
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const bannerData = {
      primaryUrl: uploadResult.publicUrl,
      variants: [],
      position: position || 0,
      containerHeight: containerHeight || 450,
      lastUpdated: new Date(),
      googleDriveId: uploadResult.id,
      metadata: {
        fileName: uploadResult.name,
        size: uploadResult.size,
        mimeType: uploadResult.mimeType
      }
    };

    // Store banner data as proper MongoDB object (no JSON.stringify needed)
    user.banner = bannerData;
    await user.save();

    // Step 4: Cleanup temp image
    const { cleanupTempImageInternal } = require('../image/tempImageController');
    const cleanupResult = await cleanupTempImageInternal(tempId);

    if (cleanupResult.success) {
      console.log('[handleTempToGoogleDriveUpload] Temp image cleaned up successfully');
    } else {
      console.warn('[handleTempToGoogleDriveUpload] Failed to cleanup temp image:', cleanupResult.error);
    }

    console.log('[handleTempToGoogleDriveUpload] Workflow completed successfully:', {
      userId,
      googleDriveUrl: uploadResult.publicUrl,
      position,
      googleDriveId: uploadResult.id
    });

    res.json({
      success: true,
      message: 'Banner uploaded and positioned successfully',
      bannerUrl: uploadResult.publicUrl,
      position: position,
      googleDriveId: uploadResult.id
    });

  } catch (error) {
    console.error('[handleTempToGoogleDriveUpload] Error:', error);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete temp-to-Google Drive upload'
    });
  }
}

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