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
 * Supports both direct file upload and temp-to-final upload workflow
 */
const uploadImageController = async (req, res) => {
  try {
    const { file, imageType } = req;
    const { oldImageUrl, entityId, tempId } = req.body;

    let fileBuffer, originalName;

    // Check if this is a temp-to-final upload or direct file upload
    if (tempId) {
      // Temp-to-final upload workflow
      console.log('[ImageController] Processing temp-to-final upload:', { tempId, imageType });

      // Import temp image functions
      const tempImageController = require('./tempImageController');

      // Get temp image data from memory
      const tempImageData = tempImageController.tempImages.get(tempId);
      if (!tempImageData) {
        return res.status(404).json({
          success: false,
          error: 'Temporary image not found or expired'
        });
      }

      // Read temp file
      const fs = require('fs').promises;
      try {
        fileBuffer = await fs.readFile(tempImageData.filePath);
        originalName = tempImageData.originalName;
        console.log('[ImageController] Temp file loaded:', {
          tempId,
          originalName,
          size: fileBuffer.length
        });
      } catch (error) {
        console.error('[ImageController] Failed to read temp file:', error);
        return res.status(404).json({
          success: false,
          error: 'Temporary image file not found'
        });
      }
    } else {
      // Direct file upload
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded and no tempId provided'
        });
      }
      fileBuffer = file.buffer;
      originalName = file.originalname;
      console.log('[ImageController] Processing direct file upload:', {
        originalName,
        size: fileBuffer.length
      });
    }

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
        result = await uploadAvatar(fileBuffer, originalName, userId, oldImageUrl);

        // Update user avatar in database
        if (result && result.primaryUrl) {
          try {
            const User = require('../../models/user');
            console.log('[ImageController] Starting database update for user:', userId);
            console.log('[ImageController] New avatar URL:', result.primaryUrl);

            const user = await User.findById(userId);

            if (!user) {
              console.error('[ImageController] User not found for avatar update:', userId);
              throw new Error('User not found');
            }

            // Update avatar with proper structure
            const newAvatarData = {
              primaryUrl: result.primaryUrl,
              variants: result.variants || [],
              googleDriveId: result.googleDriveId || '',
              lastUpdated: new Date(),
              metadata: {
                originalFilename: result.metadata?.originalFilename || originalName,
                processedVariants: result.metadata?.processedVariants || 0,
                uploadedFiles: result.metadata?.uploadedFiles || 0,
                fileSize: result.metadata?.fileSize || '',
                mimeType: result.metadata?.mimeType || '',
                dimensions: result.metadata?.dimensions || { width: 0, height: 0 }
              }
            };

            console.log('[ImageController] Updating avatar data:', newAvatarData);
            user.avatar = newAvatarData;

            // Save and verify the update
            const savedUser = await user.save();
            console.log('[ImageController] User saved successfully');

            // Verify the avatar was actually saved
            const verifyUser = await User.findById(userId);
            if (verifyUser && verifyUser.avatar && verifyUser.avatar.primaryUrl === result.primaryUrl) {
              console.log('[ImageController] Avatar update verified in database:', verifyUser.avatar.primaryUrl);

              // Add user data to result for frontend
              result.user = {
                id: savedUser._id,
                avatar: savedUser.avatar, // Return full avatar object
                avatarUrl: result.primaryUrl, // For backward compatibility
                email: savedUser.email,
                name: savedUser.name,
                slug: savedUser.slug
              };
            } else {
              console.error('[ImageController] Avatar update verification failed');
              throw new Error('Avatar update verification failed');
            }
          } catch (dbError) {
            console.error('[ImageController] Failed to update user avatar in database:', dbError);
            // Return error response if database update fails for avatar uploads
            return res.status(500).json({
              success: false,
              error: 'Avatar uploaded but failed to update user profile. Please try again.',
              details: dbError.message
            });
          }
        } else {
          console.error('[ImageController] Avatar upload result missing primaryUrl:', result);
          return res.status(500).json({
            success: false,
            error: 'Avatar upload failed - no URL returned'
          });
        }
        break;

      case 'banner':
        const bannerUserId = req.user?.id || req.user?._id;
        if (!bannerUserId) {
          return res.status(401).json({
            success: false,
            error: 'User authentication required for banner upload'
          });
        }
        result = await uploadBanner(fileBuffer, originalName, bannerUserId, oldImageUrl);
        break;

      case 'story':
        // Allow story image uploads without entityId for new story creation
        // The story ID will be associated later when the story is saved
        result = await uploadStoryImage(fileBuffer, originalName, entityId || null, oldImageUrl);
        break;

      case 'comic':
        if (!entityId) {
          return res.status(400).json({
            success: false,
            error: 'Chapter ID is required'
          });
        }
        result = await uploadComicPage(fileBuffer, originalName, entityId, oldImageUrl);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid image type. Supported types: avatar, banner, story, comic'
        });
    }

    // Cleanup temp file if this was a temp-to-final upload
    if (tempId) {
      try {
        const tempImageController = require('./tempImageController');
        const cleanupResult = await tempImageController.cleanupTempImageInternal(tempId);
        if (cleanupResult.success) {
          console.log('[ImageController] Temp file cleaned up successfully:', tempId);
        } else {
          console.warn('[ImageController] Failed to cleanup temp file:', cleanupResult.error);
        }
      } catch (error) {
        console.warn('[ImageController] Error during temp file cleanup:', error);
      }
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
