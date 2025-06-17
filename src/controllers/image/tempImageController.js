/**
 * Temporary Image Controller
 * Xử lý upload và quản lý ảnh tạm thời trước khi upload lên Google Drive
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

// Temporary storage directory
const TEMP_DIR = path.join(__dirname, '../../temp/images');
const TEMP_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

// In-memory tracking of temporary images
const tempImages = new Map();

/**
 * Ensure temp directory exists
 */
async function ensureTempDir() {
  try {
    await fs.access(TEMP_DIR);
  } catch (error) {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.log('[TempImage] Created temp directory:', TEMP_DIR);
  }
}

/**
 * Upload image to temporary storage
 * @route POST /api/images/upload/temp
 */
exports.uploadTempImage = async (req, res) => {
  try {
    console.log('[TempImage] Upload temp image request received');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Ensure temp directory exists
    await ensureTempDir();

    // Generate unique temp ID
    const tempId = uuidv4();
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const tempFileName = `${tempId}${fileExtension}`;
    const tempFilePath = path.join(TEMP_DIR, tempFileName);

    console.log('[TempImage] Processing temp upload:', {
      tempId,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      tempFilePath
    });

    // Process and save image
    let processedBuffer;
    
    if (req.file.mimetype.startsWith('image/')) {
      // Optimize image for web preview
      processedBuffer = await sharp(req.file.buffer)
        .resize(1200, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } else {
      processedBuffer = req.file.buffer;
    }

    // Save to temp directory
    await fs.writeFile(tempFilePath, processedBuffer);

    // Track temp image with metadata
    const tempImageData = {
      tempId,
      originalName: req.file.originalname,
      fileName: tempFileName,
      filePath: tempFilePath,
      size: processedBuffer.length,
      mimetype: req.file.mimetype,
      uploadedAt: new Date(),
      userId: req.user?.id
    };

    tempImages.set(tempId, tempImageData);

    // Generate temporary URL
    const tempUrl = `${process.env.API_BASE_URL || 'http://localhost:8000'}/api/images/temp/${tempId}`;

    console.log('[TempImage] Temp image saved successfully:', {
      tempId,
      tempUrl,
      size: processedBuffer.length
    });

    res.json({
      success: true,
      message: 'Image uploaded to temporary storage',
      data: {
        tempId,
        tempUrl,
        originalName: req.file.originalname,
        size: processedBuffer.length,
        mimetype: req.file.mimetype
      }
    });

  } catch (error) {
    console.error('[TempImage] Upload temp image error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to upload image to temporary storage'
    });
  }
};

/**
 * Serve temporary image
 * @route GET /api/images/temp/:tempId
 */
exports.serveTempImage = async (req, res) => {
  try {
    const { tempId } = req.params;
    
    console.log('[TempImage] Serving temp image:', tempId);

    // Check if temp image exists
    const tempImageData = tempImages.get(tempId);
    if (!tempImageData) {
      return res.status(404).json({
        success: false,
        error: 'Temporary image not found or expired'
      });
    }

    // Check if file still exists on disk
    try {
      await fs.access(tempImageData.filePath);
    } catch (error) {
      // File doesn't exist, remove from tracking
      tempImages.delete(tempId);
      return res.status(404).json({
        success: false,
        error: 'Temporary image file not found'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', tempImageData.mimetype);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Stream file to response
    const fileBuffer = await fs.readFile(tempImageData.filePath);
    res.send(fileBuffer);

  } catch (error) {
    console.error('[TempImage] Serve temp image error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to serve temporary image'
    });
  }
};

/**
 * Delete temporary image
 * @route DELETE /api/images/temp/:tempId
 */
exports.deleteTempImage = async (req, res) => {
  try {
    const { tempId } = req.params;
    
    console.log('[TempImage] Deleting temp image:', tempId);

    // Check if temp image exists
    const tempImageData = tempImages.get(tempId);
    if (!tempImageData) {
      return res.status(404).json({
        success: false,
        error: 'Temporary image not found'
      });
    }

    // Delete file from disk
    try {
      await fs.unlink(tempImageData.filePath);
      console.log('[TempImage] Temp file deleted from disk:', tempImageData.filePath);
    } catch (error) {
      console.warn('[TempImage] Failed to delete temp file (may not exist):', error.message);
    }

    // Remove from tracking
    tempImages.delete(tempId);

    res.json({
      success: true,
      message: 'Temporary image deleted successfully'
    });

  } catch (error) {
    console.error('[TempImage] Delete temp image error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete temporary image'
    });
  }
};

/**
 * Get temporary image info
 * @route GET /api/images/temp/:tempId/info
 */
exports.getTempImageInfo = async (req, res) => {
  try {
    const { tempId } = req.params;
    
    const tempImageData = tempImages.get(tempId);
    if (!tempImageData) {
      return res.status(404).json({
        success: false,
        error: 'Temporary image not found'
      });
    }

    res.json({
      success: true,
      data: {
        tempId: tempImageData.tempId,
        originalName: tempImageData.originalName,
        size: tempImageData.size,
        mimetype: tempImageData.mimetype,
        uploadedAt: tempImageData.uploadedAt,
        userId: tempImageData.userId
      }
    });

  } catch (error) {
    console.error('[TempImage] Get temp image info error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get temporary image info'
    });
  }
};

/**
 * Cleanup expired temporary images
 */
async function cleanupExpiredTempImages() {
  try {
    const now = new Date();
    const expiredImages = [];

    // Find expired images (older than 1 hour)
    for (const [tempId, tempImageData] of tempImages.entries()) {
      const ageMs = now.getTime() - tempImageData.uploadedAt.getTime();
      if (ageMs > TEMP_CLEANUP_INTERVAL) {
        expiredImages.push({ tempId, tempImageData });
      }
    }

    if (expiredImages.length > 0) {
      console.log(`[TempImage] Cleaning up ${expiredImages.length} expired temp images`);

      for (const { tempId, tempImageData } of expiredImages) {
        try {
          // Delete file from disk
          await fs.unlink(tempImageData.filePath);
          // Remove from tracking
          tempImages.delete(tempId);
          console.log(`[TempImage] Cleaned up expired temp image: ${tempId}`);
        } catch (error) {
          console.warn(`[TempImage] Failed to cleanup temp image ${tempId}:`, error.message);
          // Remove from tracking even if file deletion failed
          tempImages.delete(tempId);
        }
      }
    }

  } catch (error) {
    console.error('[TempImage] Cleanup error:', error);
  }
}

/**
 * Initialize temp image system
 */
exports.initTempImageSystem = async () => {
  try {
    await ensureTempDir();
    
    // Start cleanup interval
    setInterval(cleanupExpiredTempImages, TEMP_CLEANUP_INTERVAL);
    
    console.log('[TempImage] Temp image system initialized');
    console.log('[TempImage] Cleanup interval set to:', TEMP_CLEANUP_INTERVAL / 1000 / 60, 'minutes');
    
  } catch (error) {
    console.error('[TempImage] Failed to initialize temp image system:', error);
  }
};

/**
 * Get temp image file path for internal use
 */
exports.getTempImagePath = (tempId) => {
  const tempImageData = tempImages.get(tempId);
  return tempImageData ? tempImageData.filePath : null;
};

/**
 * Get all temp images (for debugging)
 */
exports.getAllTempImages = () => {
  return Array.from(tempImages.values());
};

/**
 * Internal cleanup function for temp image (for use by other controllers)
 */
exports.cleanupTempImageInternal = async (tempId) => {
  try {
    console.log('[TempImage] Internal cleanup for temp image:', tempId);

    // Check if temp image exists
    const tempImageData = tempImages.get(tempId);
    if (!tempImageData) {
      console.warn('[TempImage] Temp image not found for cleanup:', tempId);
      return { success: false, error: 'Temporary image not found' };
    }

    // Delete file from disk
    try {
      await fs.unlink(tempImageData.filePath);
      console.log('[TempImage] Temp file deleted from disk:', tempImageData.filePath);
    } catch (error) {
      console.warn('[TempImage] Failed to delete temp file (may not exist):', error.message);
    }

    // Remove from tracking
    tempImages.delete(tempId);

    console.log('[TempImage] Internal cleanup completed for:', tempId);
    return { success: true, message: 'Temporary image deleted successfully' };

  } catch (error) {
    console.error('[TempImage] Internal cleanup error:', error);
    return { success: false, error: 'Failed to delete temporary image' };
  }
};

/**
 * Export tempImages Map for use by other controllers
 */
exports.tempImages = tempImages;
