/**
 * Image Controller
 * Xử lý các API endpoints cho upload ảnh
 */

const { 
  uploadAvatar, 
  uploadBanner, 
  uploadStoryImage, 
  uploadComicPage,
  getImageStats 
} = require('../../services/image/imageService');

/**
 * Upload avatar
 * POST /api/images/upload/avatar
 */
const uploadAvatarController = async (req, res) => {
  try {
    const { file } = req;
    const { oldImageUrl } = req.body;
    
    // Lấy userId từ token (giả sử đã được xử lý bởi auth middleware)
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const result = await uploadAvatar(
      file.buffer,
      file.originalname,
      userId,
      oldImageUrl
    );

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: result
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload avatar'
    });
  }
};

/**
 * Upload banner
 * POST /api/images/upload/banner
 */
const uploadBannerController = async (req, res) => {
  try {
    const { file } = req;
    const { oldImageUrl } = req.body;
    
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const result = await uploadBanner(
      file.buffer,
      file.originalname,
      userId,
      oldImageUrl
    );

    res.json({
      success: true,
      message: 'Banner uploaded successfully',
      data: result
    });

  } catch (error) {
    console.error('Banner upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload banner'
    });
  }
};

/**
 * Upload story image
 * POST /api/images/upload/story
 */
const uploadStoryImageController = async (req, res) => {
  try {
    const { file } = req;
    const { oldImageUrl, storyId } = req.body;
    
    if (!storyId) {
      return res.status(400).json({
        success: false,
        error: 'Story ID is required'
      });
    }

    const result = await uploadStoryImage(
      file.buffer,
      file.originalname,
      storyId,
      oldImageUrl
    );

    res.json({
      success: true,
      message: 'Story image uploaded successfully',
      data: result
    });

  } catch (error) {
    console.error('Story image upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload story image'
    });
  }
};

/**
 * Upload comic page
 * POST /api/images/upload/comic
 */
const uploadComicPageController = async (req, res) => {
  try {
    const { file } = req;
    const { oldImageUrl, chapterId } = req.body;
    
    if (!chapterId) {
      return res.status(400).json({
        success: false,
        error: 'Chapter ID is required'
      });
    }

    const result = await uploadComicPage(
      file.buffer,
      file.originalname,
      chapterId,
      oldImageUrl
    );

    res.json({
      success: true,
      message: 'Comic page uploaded successfully',
      data: result
    });

  } catch (error) {
    console.error('Comic page upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload comic page'
    });
  }
};

/**
 * Generic image upload endpoint
 * POST /api/images/upload
 */
const uploadImageController = async (req, res) => {
  try {
    const { file, imageType } = req;
    const { oldImageUrl, entityId } = req.body;
    
    let result;
    
    switch (imageType) {
      case 'avatar':
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'User authentication required for avatar upload'
          });
        }
        result = await uploadAvatar(file.buffer, file.originalname, userId, oldImageUrl);
        break;
        
      case 'banner':
        const bannerUserId = req.user?.id || req.user?._id;
        if (!bannerUserId) {
          return res.status(401).json({
            success: false,
            error: 'User authentication required for banner upload'
          });
        }
        result = await uploadBanner(file.buffer, file.originalname, bannerUserId, oldImageUrl);
        break;
        
      case 'story':
        if (!entityId) {
          return res.status(400).json({
            success: false,
            error: 'Story ID is required'
          });
        }
        result = await uploadStoryImage(file.buffer, file.originalname, entityId, oldImageUrl);
        break;
        
      case 'comic':
        if (!entityId) {
          return res.status(400).json({
            success: false,
            error: 'Chapter ID is required'
          });
        }
        result = await uploadComicPage(file.buffer, file.originalname, entityId, oldImageUrl);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid image type. Supported types: avatar, banner, story, comic'
        });
    }

    res.json({
      success: true,
      message: `${imageType} uploaded successfully`,
      data: result
    });

  } catch (error) {
    console.error('Generic image upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload image'
    });
  }
};

/**
 * Get image processing stats
 * GET /api/images/stats
 */
const getImageStatsController = async (req, res) => {
  try {
    const stats = getImageStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get image stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get image stats'
    });
  }
};

/**
 * Health check endpoint
 * GET /api/images/health
 */
const healthCheckController = async (req, res) => {
  try {
    const stats = getImageStats();
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        imageProcessing: 'operational',
        googleDrive: stats.googleDriveConfigured ? 'operational' : 'not configured',
        memory: stats.memoryUsage
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
};

module.exports = {
  uploadAvatarController,
  uploadBannerController,
  uploadStoryImageController,
  uploadComicPageController,
  uploadImageController,
  getImageStatsController,
  healthCheckController
};
