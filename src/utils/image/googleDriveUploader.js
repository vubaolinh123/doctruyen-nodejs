/**
 * Google Drive Upload Service
 * Xử lý upload ảnh lên Google Drive với tối ưu hóa
 */

const { createDriveClient, getFolderIds } = require('../../config/googleDrive');
const { Readable } = require('stream');

/**
 * Chuyển đổi buffer thành stream
 */
const bufferToStream = (buffer) => {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
};

/**
 * Upload một file lên Google Drive
 */
const uploadSingleFile = async (buffer, filename, mimeType, folderId = null) => {
  try {
    const { drive } = createDriveClient();
    
    const fileMetadata = {
      name: filename,
      parents: folderId ? [folderId] : undefined
    };

    const media = {
      mimeType: mimeType,
      body: bufferToStream(buffer)
    };

    console.log(`Uploading ${filename} to Google Drive...`);
    
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, size, mimeType, webViewLink'
    });

    // Set file permissions to public
    await drive.permissions.create({
      fileId: response.data.id,
      resource: {
        role: 'reader',
        type: 'anyone'
      }
    });

    console.log(`✅ Successfully uploaded ${filename} with ID: ${response.data.id}`);
    
    return {
      id: response.data.id,
      name: response.data.name,
      size: response.data.size,
      mimeType: response.data.mimeType,
      webViewLink: response.data.webViewLink,
      publicUrl: `https://lh3.googleusercontent.com/d/${response.data.id}`,
      driveUrl: `https://drive.google.com/uc?id=${response.data.id}`
    };
  } catch (error) {
    console.error(`❌ Failed to upload ${filename}:`, error);
    throw new Error(`Upload failed for ${filename}: ${error.message}`);
  }
};

/**
 * Upload multiple files (variants) lên Google Drive
 */
const uploadMultipleFiles = async (processedImages, imageType, userId = null) => {
  try {
    const folderIds = getFolderIds();
    const folderId = folderIds[imageType];
    
    if (!folderId) {
      console.warn(`No folder ID configured for image type: ${imageType}`);
    }

    const uploadPromises = processedImages.map(async (image) => {
      // Tạo filename unique với timestamp và userId
      const timestamp = Date.now();
      const uniqueFilename = userId 
        ? `${imageType}_${userId}_${timestamp}_${image.filename}`
        : `${imageType}_${timestamp}_${image.filename}`;

      const mimeType = image.format === 'webp' ? 'image/webp' : 
                      image.format === 'jpeg' ? 'image/jpeg' : 'image/png';

      const result = await uploadSingleFile(
        image.buffer, 
        uniqueFilename, 
        mimeType, 
        folderId
      );

      return {
        ...result,
        size: image.size,
        variant: image.filename.includes('_') ? 
          image.filename.split('_').pop().split('.')[0] : 'original'
      };
    });

    const uploadResults = await Promise.all(uploadPromises);
    
    console.log(`✅ Successfully uploaded ${uploadResults.length} variants for ${imageType}`);
    
    return {
      success: true,
      imageType,
      variants: uploadResults,
      primaryUrl: uploadResults[0]?.publicUrl, // URL chính (variant đầu tiên)
      allUrls: uploadResults.map(result => ({
        variant: result.variant,
        url: result.publicUrl,
        size: result.size
      }))
    };
  } catch (error) {
    console.error(`❌ Failed to upload multiple files for ${imageType}:`, error);
    throw error;
  }
};

/**
 * Xóa file từ Google Drive
 */
const deleteFileFromDrive = async (fileId) => {
  try {
    const { drive } = createDriveClient();
    
    await drive.files.delete({
      fileId: fileId
    });
    
    console.log(`✅ Successfully deleted file with ID: ${fileId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete file ${fileId}:`, error);
    // Không throw error để không làm gián đoạn quá trình upload mới
    return false;
  }
};

/**
 * Xóa multiple files từ Google Drive
 */
const deleteMultipleFiles = async (fileIds) => {
  try {
    const deletePromises = fileIds.map(fileId => deleteFileFromDrive(fileId));
    const results = await Promise.all(deletePromises);
    
    const successCount = results.filter(result => result === true).length;
    console.log(`✅ Successfully deleted ${successCount}/${fileIds.length} files`);
    
    return {
      success: true,
      deletedCount: successCount,
      totalCount: fileIds.length
    };
  } catch (error) {
    console.error('❌ Failed to delete multiple files:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Trích xuất file ID từ Google Drive URL
 */
const extractFileIdFromUrl = (url) => {
  if (!url) return null;
  
  // Các pattern URL khác nhau của Google Drive
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/,  // drive.google.com/file/d/ID
    /id=([a-zA-Z0-9-_]+)/,    // drive.google.com/uc?id=ID
    /\/([a-zA-Z0-9-_]+)$/     // lh3.googleusercontent.com/d/ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
};

/**
 * Lấy thông tin file từ Google Drive
 */
const getFileInfo = async (fileId) => {
  try {
    const { drive } = createDriveClient();
    
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, size, mimeType, createdTime, modifiedTime'
    });
    
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to get file info for ${fileId}:`, error);
    throw error;
  }
};

/**
 * Tạo optimized URL cho Google Drive file
 */
const getOptimizedUrl = (fileId, variant = null) => {
  const baseUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
  
  // Có thể thêm parameters cho optimization nếu cần
  if (variant) {
    return `${baseUrl}?variant=${variant}`;
  }
  
  return baseUrl;
};

module.exports = {
  uploadSingleFile,
  uploadMultipleFiles,
  deleteFileFromDrive,
  deleteMultipleFiles,
  extractFileIdFromUrl,
  getFileInfo,
  getOptimizedUrl,
  bufferToStream
};
