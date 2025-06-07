/**
 * Image Service
 * Service chính để xử lý upload và tối ưu hóa ảnh
 */

const { processImage, cleanupTempFiles } = require('../../utils/image/imageProcessor');
const { uploadMultipleFiles, deleteMultipleFiles, extractFileIdFromUrl } = require('../../utils/image/googleDriveUploader');
const { hasValidGoogleCredentials } = require('../../config/googleDrive');

/**
 * Upload và xử lý ảnh
 */
const uploadAndProcessImage = async (fileBuffer, originalFilename, imageType, userId = null, oldImageUrl = null) => {
  let tempFiles = [];
  
  try {
    // Kiểm tra cấu hình Google Drive
    if (!hasValidGoogleCredentials()) {
      throw new Error('Google Drive credentials not configured properly');
    }

    console.log(`🚀 Starting image processing for type: ${imageType}`);
    console.log(`📁 Original file: ${originalFilename}, Size: ${fileBuffer.length} bytes`);

    // Xử lý ảnh thành các variants
    const processedImages = await processImage(fileBuffer, originalFilename, imageType);
    
    console.log(`✅ Processed ${processedImages.length} image variants`);

    // Xóa ảnh cũ nếu có
    if (oldImageUrl) {
      await deleteOldImage(oldImageUrl);
    }

    // Upload tất cả variants lên Google Drive
    const uploadResult = await uploadMultipleFiles(processedImages, imageType, userId);

    // Cleanup memory
    processedImages.forEach(img => {
      img.buffer = null;
    });

    console.log(`🎉 Successfully completed image upload for ${imageType}`);

    return {
      success: true,
      imageType,
      primaryUrl: uploadResult.primaryUrl,
      variants: uploadResult.allUrls,
      metadata: {
        originalFilename,
        processedVariants: processedImages.length,
        uploadedFiles: uploadResult.variants.length
      }
    };

  } catch (error) {
    console.error(`❌ Image upload failed for ${imageType}:`, error);
    
    // Cleanup temp files nếu có lỗi
    if (tempFiles.length > 0) {
      await cleanupTempFiles(tempFiles);
    }

    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Xóa ảnh cũ từ Google Drive
 */
const deleteOldImage = async (imageUrl) => {
  try {
    if (!imageUrl || !imageUrl.includes('drive.google.com') && !imageUrl.includes('googleusercontent.com')) {
      console.log('🔄 Skipping deletion - not a Google Drive URL');
      return;
    }

    const fileId = extractFileIdFromUrl(imageUrl);
    if (!fileId) {
      console.warn('⚠️ Could not extract file ID from URL:', imageUrl);
      return;
    }

    console.log(`🗑️ Deleting old image with ID: ${fileId}`);
    await deleteMultipleFiles([fileId]);
    
  } catch (error) {
    console.warn('⚠️ Failed to delete old image:', error.message);
    // Không throw error để không làm gián đoạn quá trình upload mới
  }
};

/**
 * Upload avatar với xử lý đặc biệt
 */
const uploadAvatar = async (fileBuffer, originalFilename, userId, oldAvatarUrl = null) => {
  try {
    const result = await uploadAndProcessImage(
      fileBuffer, 
      originalFilename, 
      'avatar', 
      userId, 
      oldAvatarUrl
    );

    return {
      ...result,
      avatarUrl: result.primaryUrl,
      sizes: result.variants
    };
  } catch (error) {
    throw new Error(`Avatar upload failed: ${error.message}`);
  }
};

/**
 * Upload banner với xử lý đặc biệt
 */
const uploadBanner = async (fileBuffer, originalFilename, userId, oldBannerUrl = null) => {
  try {
    const result = await uploadAndProcessImage(
      fileBuffer, 
      originalFilename, 
      'banner', 
      userId, 
      oldBannerUrl
    );

    return {
      ...result,
      bannerUrl: result.primaryUrl,
      sizes: result.variants
    };
  } catch (error) {
    throw new Error(`Banner upload failed: ${error.message}`);
  }
};

/**
 * Upload story image với xử lý đặc biệt
 */
const uploadStoryImage = async (fileBuffer, originalFilename, storyId, oldImageUrl = null) => {
  try {
    const result = await uploadAndProcessImage(
      fileBuffer, 
      originalFilename, 
      'story', 
      storyId, 
      oldImageUrl
    );

    return {
      ...result,
      storyImageUrl: result.primaryUrl,
      sizes: result.variants
    };
  } catch (error) {
    throw new Error(`Story image upload failed: ${error.message}`);
  }
};

/**
 * Upload comic page với xử lý đặc biệt
 */
const uploadComicPage = async (fileBuffer, originalFilename, chapterId, oldImageUrl = null) => {
  try {
    const result = await uploadAndProcessImage(
      fileBuffer, 
      originalFilename, 
      'comic', 
      chapterId, 
      oldImageUrl
    );

    return {
      ...result,
      comicPageUrl: result.primaryUrl,
      sizes: result.variants
    };
  } catch (error) {
    throw new Error(`Comic page upload failed: ${error.message}`);
  }
};

/**
 * Batch upload multiple images
 */
const uploadMultipleImages = async (files, imageType, entityId) => {
  try {
    const uploadPromises = files.map(async (file, index) => {
      const filename = `${file.originalname || `image_${index}`}`;
      return await uploadAndProcessImage(
        file.buffer,
        filename,
        imageType,
        entityId
      );
    });

    const results = await Promise.all(uploadPromises);
    
    return {
      success: true,
      uploadedCount: results.length,
      results: results
    };
  } catch (error) {
    throw new Error(`Batch upload failed: ${error.message}`);
  }
};

/**
 * Lấy thống kê về image processing
 */
const getImageStats = () => {
  const memUsage = process.memoryUsage();
  
  return {
    memoryUsage: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
    },
    googleDriveConfigured: hasValidGoogleCredentials()
  };
};

module.exports = {
  uploadAndProcessImage,
  uploadAvatar,
  uploadBanner,
  uploadStoryImage,
  uploadComicPage,
  uploadMultipleImages,
  deleteOldImage,
  getImageStats
};
