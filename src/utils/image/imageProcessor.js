/**
 * Image Processing Utilities
 * Xử lý và tối ưu hóa hình ảnh cho website đọc truyện
 */

const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

/**
 * Cấu hình cho các loại ảnh khác nhau
 */
const IMAGE_CONFIGS = {
  avatar: {
    sizes: [
      { width: 200, height: 200, suffix: '_200x200' },
      { width: 400, height: 400, suffix: '_400x400' }
    ],
    format: 'webp',
    quality: 80
  },
  banner: {
    sizes: [
      { width: 800, suffix: '_800w' },
      { width: 400, suffix: '_400w' }
    ],
    format: 'webp',
    quality: 75
  },
  story: {
    sizes: [
      { width: 1200, suffix: '_desktop' },
      { width: 600, suffix: '_mobile' }
    ],
    format: 'jpeg',
    quality: 85
  },
  comic: {
    sizes: [
      { width: 400, suffix: '_thumb', format: 'webp', quality: 70 },
      { width: 800, suffix: '_medium', format: 'webp', quality: 80 },
      { width: 2400, suffix: '_full', format: 'jpeg', quality: 90 }
    ]
  }
};

/**
 * Tạo thư mục tạm thời nếu chưa tồn tại
 */
const ensureTempDir = async () => {
  const tempDir = path.join(__dirname, '../../../temp');
  await fs.ensureDir(tempDir);
  return tempDir;
};

/**
 * Xử lý ảnh avatar
 */
const processAvatarImage = async (inputBuffer, filename) => {
  const config = IMAGE_CONFIGS.avatar;
  const results = [];
  
  try {
    for (const size of config.sizes) {
      const outputFilename = `${path.parse(filename).name}${size.suffix}.${config.format}`;
      
      const processedBuffer = await sharp(inputBuffer)
        .resize(size.width, size.height, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: config.quality })
        .toBuffer();

      results.push({
        buffer: processedBuffer,
        filename: outputFilename,
        size: `${size.width}x${size.height}`,
        format: config.format
      });
    }

    return results;
  } catch (error) {
    console.error('Error processing avatar image:', error);
    throw new Error(`Avatar processing failed: ${error.message}`);
  }
};

/**
 * Xử lý ảnh banner
 */
const processBannerImage = async (inputBuffer, filename) => {
  const config = IMAGE_CONFIGS.banner;
  const results = [];
  
  try {
    // Lấy metadata của ảnh gốc
    const metadata = await sharp(inputBuffer).metadata();
    
    for (const size of config.sizes) {
      const outputFilename = `${path.parse(filename).name}${size.suffix}.${config.format}`;
      
      // Tính toán height dựa trên aspect ratio gốc
      const aspectRatio = metadata.width / metadata.height;
      const height = Math.round(size.width / aspectRatio);
      
      const processedBuffer = await sharp(inputBuffer)
        .resize(size.width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: config.quality })
        .toBuffer();

      results.push({
        buffer: processedBuffer,
        filename: outputFilename,
        size: `${size.width}x${height}`,
        format: config.format
      });
    }

    return results;
  } catch (error) {
    console.error('Error processing banner image:', error);
    throw new Error(`Banner processing failed: ${error.message}`);
  }
};

/**
 * Xử lý ảnh story
 */
const processStoryImage = async (inputBuffer, filename) => {
  const config = IMAGE_CONFIGS.story;
  const results = [];
  
  try {
    // Lấy metadata của ảnh gốc
    const metadata = await sharp(inputBuffer).metadata();
    
    for (const size of config.sizes) {
      const outputFilename = `${path.parse(filename).name}${size.suffix}.${config.format}`;
      
      // Tính toán height dựa trên aspect ratio gốc
      const aspectRatio = metadata.width / metadata.height;
      const height = Math.round(size.width / aspectRatio);
      
      const processedBuffer = await sharp(inputBuffer)
        .resize(size.width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: config.quality })
        .toBuffer();

      results.push({
        buffer: processedBuffer,
        filename: outputFilename,
        size: `${size.width}x${height}`,
        format: config.format
      });
    }

    return results;
  } catch (error) {
    console.error('Error processing story image:', error);
    throw new Error(`Story processing failed: ${error.message}`);
  }
};

/**
 * Xử lý ảnh comic page
 */
const processComicImage = async (inputBuffer, filename) => {
  const config = IMAGE_CONFIGS.comic;
  const results = [];
  
  try {
    // Lấy metadata của ảnh gốc
    const metadata = await sharp(inputBuffer).metadata();
    
    for (const size of config.sizes) {
      const outputFilename = `${path.parse(filename).name}${size.suffix}.${size.format}`;
      
      let processedBuffer;
      
      if (size.width >= metadata.width) {
        // Nếu kích thước yêu cầu lớn hơn ảnh gốc, giữ nguyên
        if (size.format === 'webp') {
          processedBuffer = await sharp(inputBuffer)
            .webp({ quality: size.quality })
            .toBuffer();
        } else {
          processedBuffer = await sharp(inputBuffer)
            .jpeg({ quality: size.quality })
            .toBuffer();
        }
      } else {
        // Resize ảnh
        const aspectRatio = metadata.width / metadata.height;
        const height = Math.round(size.width / aspectRatio);
        
        if (size.format === 'webp') {
          processedBuffer = await sharp(inputBuffer)
            .resize(size.width, height, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: size.quality })
            .toBuffer();
        } else {
          processedBuffer = await sharp(inputBuffer)
            .resize(size.width, height, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({ quality: size.quality })
            .toBuffer();
        }
      }

      results.push({
        buffer: processedBuffer,
        filename: outputFilename,
        size: `${size.width}x${Math.round(size.width / (metadata.width / metadata.height))}`,
        format: size.format
      });
    }

    return results;
  } catch (error) {
    console.error('Error processing comic image:', error);
    throw new Error(`Comic processing failed: ${error.message}`);
  }
};

/**
 * Xử lý ảnh theo loại
 */
const processImage = async (inputBuffer, filename, imageType) => {
  // Kiểm tra memory usage trước khi xử lý
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    console.warn('High memory usage detected, forcing garbage collection');
    if (global.gc) {
      global.gc();
    }
  }

  switch (imageType) {
    case 'avatar':
      return await processAvatarImage(inputBuffer, filename);
    case 'banner':
      return await processBannerImage(inputBuffer, filename);
    case 'story':
      return await processStoryImage(inputBuffer, filename);
    case 'comic':
      return await processComicImage(inputBuffer, filename);
    default:
      throw new Error(`Unsupported image type: ${imageType}`);
  }
};

/**
 * Cleanup temporary files
 */
const cleanupTempFiles = async (filePaths) => {
  for (const filePath of filePaths) {
    try {
      await fs.remove(filePath);
    } catch (error) {
      console.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
    }
  }
};

module.exports = {
  processImage,
  processAvatarImage,
  processBannerImage,
  processStoryImage,
  processComicImage,
  ensureTempDir,
  cleanupTempFiles,
  IMAGE_CONFIGS
};
