/**
 * Upload Middleware
 * Xử lý file upload với validation và memory management
 */

const multer = require('multer');
const path = require('path');

/**
 * Cấu hình memory storage cho multer
 * Sử dụng memory storage để xử lý trực tiếp buffer
 */
const storage = multer.memoryStorage();

/**
 * File filter để kiểm tra loại file
 */
const fileFilter = (req, file, cb) => {
  // Kiểm tra MIME type
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file hình ảnh (JPEG, PNG, WebP, GIF)'), false);
  }
};

/**
 * Cấu hình multer với giới hạn kích thước
 */
const createUploadMiddleware = (maxSize = 10 * 1024 * 1024) => { // Default 10MB
  return multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: maxSize,
      files: 1 // Chỉ cho phép 1 file mỗi lần
    }
  });
};

/**
 * Middleware cho upload avatar (5MB max)
 */
const uploadAvatar = createUploadMiddleware(5 * 1024 * 1024);

/**
 * Middleware cho upload banner (8MB max)
 */
const uploadBanner = createUploadMiddleware(8 * 1024 * 1024);

/**
 * Middleware cho upload story image (10MB max)
 */
const uploadStoryImage = createUploadMiddleware(10 * 1024 * 1024);

/**
 * Middleware cho upload comic page (15MB max)
 */
const uploadComicPage = createUploadMiddleware(15 * 1024 * 1024);

/**
 * Middleware cho generic upload (15MB max - largest size)
 */
const uploadGeneric = createUploadMiddleware(15 * 1024 * 1024);

/**
 * Middleware validation cho image upload
 */
const validateImageUpload = (req, res, next) => {
  try {
    // Kiểm tra có file không
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Không có file được upload'
      });
    }

    // Kiểm tra kích thước file
    if (req.file.size === 0) {
      return res.status(400).json({
        success: false,
        error: 'File rỗng'
      });
    }

    // Kiểm tra buffer
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Dữ liệu file không hợp lệ'
      });
    }

    // Validate image type parameter
    const allowedImageTypes = ['avatar', 'banner', 'story', 'comic'];
    const imageType = req.body.imageType || req.params.imageType;
    
    if (!imageType || !allowedImageTypes.includes(imageType)) {
      return res.status(400).json({
        success: false,
        error: 'Loại ảnh không hợp lệ. Chỉ chấp nhận: avatar, banner, story, comic'
      });
    }

    // Thêm imageType vào request để sử dụng trong controller
    req.imageType = imageType;

    // Log thông tin file để debug
    console.log('File upload info:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      imageType: imageType
    });

    next();
  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Lỗi validation file upload'
    });
  }
};

/**
 * Error handler cho multer
 */
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File quá lớn. Vui lòng chọn file nhỏ hơn.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Chỉ được upload 1 file mỗi lần.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Field name không hợp lệ.'
        });
      default:
        return res.status(400).json({
          success: false,
          error: `Upload error: ${error.message}`
        });
    }
  }

  // Lỗi khác (ví dụ: file type không hợp lệ)
  if (error.message) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  next(error);
};

/**
 * Middleware để cleanup memory sau khi xử lý
 */
const cleanupMemory = (req, res, next) => {
  // Cleanup sau khi response được gửi
  res.on('finish', () => {
    if (req.file && req.file.buffer) {
      req.file.buffer = null;
    }
    
    // Force garbage collection nếu có thể
    if (global.gc) {
      global.gc();
    }
  });

  next();
};

/**
 * Middleware tổng hợp cho từng loại upload
 */
const createImageUploadMiddleware = (uploadType) => {
  let uploadMiddleware;
  
  switch (uploadType) {
    case 'avatar':
      uploadMiddleware = uploadAvatar;
      break;
    case 'banner':
      uploadMiddleware = uploadBanner;
      break;
    case 'story':
      uploadMiddleware = uploadStoryImage;
      break;
    case 'comic':
      uploadMiddleware = uploadComicPage;
      break;
    default:
      throw new Error(`Unsupported upload type: ${uploadType}`);
  }

  return [
    cleanupMemory,
    uploadMiddleware.single('file'),
    handleMulterError,
    validateImageUpload
  ];
};

module.exports = {
  uploadAvatar: uploadAvatar.single('file'),
  uploadBanner: uploadBanner.single('file'),
  uploadStoryImage: uploadStoryImage.single('file'),
  uploadComicPage: uploadComicPage.single('file'),
  uploadGeneric: uploadGeneric.single('file'),
  validateImageUpload,
  handleMulterError,
  cleanupMemory,
  createImageUploadMiddleware
};
