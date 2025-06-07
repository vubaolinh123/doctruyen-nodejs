/**
 * Banner Crop Controller
 * Handles banner cropping operations based on position
 */

const sharp = require('sharp');
const { uploadSingleFile, deleteFileFromDrive, extractFileIdFromUrl } = require('../../utils/image/googleDriveUploader');
const { getFolderIds } = require('../../config/googleDrive');

/**
 * Crop banner based on Y position
 * POST /api/images/crop/banner
 */
const cropBannerController = async (req, res) => {
  try {
    const { bannerUrl, yOffset, containerHeight, outputWidth, outputHeight } = req.body;
    const userId = req.user?.id || req.user?._id;

    console.log('[bannerCropController] Crop request:', {
      bannerUrl,
      yOffset,
      containerHeight,
      outputWidth,
      outputHeight,
      userId
    });

    // Validation
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!bannerUrl) {
      return res.status(400).json({
        success: false,
        error: 'Banner URL is required'
      });
    }

    if (typeof yOffset !== 'number' || yOffset < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Y offset value'
      });
    }

    // Default values
    const targetWidth = outputWidth || 1200;
    const targetHeight = outputHeight || 675; // 16:9 ratio

    // Download the original image
    let imageBuffer;
    try {
      const response = await fetch(bannerUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('[bannerCropController] Error downloading image:', error);
      return res.status(400).json({
        success: false,
        error: 'Failed to download original image'
      });
    }

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    console.log('[bannerCropController] Original image metadata:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    });

    // Calculate crop dimensions
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    // Calculate scale factor (how much the image was scaled to fit the container width)
    const scaleFactor = originalWidth / targetWidth;
    const scaledHeight = originalHeight / scaleFactor;

    // Calculate actual Y offset in original image coordinates
    const actualYOffset = yOffset * scaleFactor;

    // Calculate crop area
    const cropHeight = Math.min(targetHeight * scaleFactor, originalHeight - actualYOffset);
    const cropWidth = Math.min(targetWidth * scaleFactor, originalWidth);

    console.log('[bannerCropController] Crop calculations:', {
      scaleFactor,
      scaledHeight,
      actualYOffset,
      cropWidth,
      cropHeight,
      cropArea: {
        left: 0,
        top: Math.round(actualYOffset),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight)
      }
    });

    // Perform the crop
    let croppedBuffer;
    try {
      croppedBuffer = await sharp(imageBuffer)
        .extract({
          left: 0,
          top: Math.round(actualYOffset),
          width: Math.round(cropWidth),
          height: Math.round(cropHeight)
        })
        .resize(targetWidth, targetHeight, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      console.log('[bannerCropController] Crop completed successfully');
    } catch (error) {
      console.error('[bannerCropController] Error cropping image:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to crop image'
      });
    }

    // Generate filename
    const timestamp = Date.now();
    const filename = `banner_cropped_${userId}_${timestamp}.jpg`;

    // Upload cropped image to Google Drive
    try {
      // Get folder ID for banners
      const folderIds = getFolderIds();
      const bannerFolderId = folderIds.banner;

      const uploadResult = await uploadSingleFile(
        croppedBuffer,
        filename,
        'image/jpeg',
        bannerFolderId
      );

      console.log('[bannerCropController] Upload result:', uploadResult);

      // Generate variants (desktop and mobile)
      const variants = [];

      // Desktop variant (800px width)
      try {
        const desktopBuffer = await sharp(croppedBuffer)
          .resize(800, 450, { fit: 'cover', position: 'center' })
          .webp({ quality: 85 })
          .toBuffer();

        const desktopFilename = `banner_desktop_${userId}_${timestamp}.webp`;
        const desktopUpload = await uploadSingleFile(
          desktopBuffer,
          desktopFilename,
          'image/webp',
          bannerFolderId
        );

        variants.push({
          variant: 'desktop',
          url: desktopUpload.publicUrl,
          size: '800x450'
        });
      } catch (error) {
        console.warn('[bannerCropController] Failed to create desktop variant:', error);
      }

      // Mobile variant (400px width)
      try {
        const mobileBuffer = await sharp(croppedBuffer)
          .resize(400, 225, { fit: 'cover', position: 'center' })
          .webp({ quality: 80 })
          .toBuffer();

        const mobileFilename = `banner_mobile_${userId}_${timestamp}.webp`;
        const mobileUpload = await uploadSingleFile(
          mobileBuffer,
          mobileFilename,
          'image/webp',
          bannerFolderId
        );

        variants.push({
          variant: 'mobile',
          url: mobileUpload.publicUrl,
          size: '400x225'
        });
      } catch (error) {
        console.warn('[bannerCropController] Failed to create mobile variant:', error);
      }

      // Delete old banner if it exists and is different
      if (bannerUrl && bannerUrl !== uploadResult.publicUrl) {
        try {
          const oldFileId = extractFileIdFromUrl(bannerUrl);
          if (oldFileId) {
            await deleteFileFromDrive(oldFileId);
            console.log('[bannerCropController] Old banner deleted:', oldFileId);
          }
        } catch (error) {
          console.warn('[bannerCropController] Failed to delete old banner:', error);
        }
      }

      // Return success response
      res.json({
        success: true,
        message: 'Banner cropped successfully',
        data: {
          primaryUrl: uploadResult.publicUrl,
          variants: variants,
          metadata: {
            originalSize: `${originalWidth}x${originalHeight}`,
            croppedSize: `${targetWidth}x${targetHeight}`,
            yOffset: yOffset,
            scaleFactor: scaleFactor
          }
        }
      });

    } catch (error) {
      console.error('[bannerCropController] Error uploading cropped image:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload cropped image'
      });
    }

  } catch (error) {
    console.error('[bannerCropController] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  cropBannerController
};
