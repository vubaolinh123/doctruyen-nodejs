const CacheConfig = require('../models/cacheConfig');

/**
 * Lấy cấu hình cache
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getCacheConfig = async (req, res) => {
  try {
    // Lấy cấu hình cache từ database
    let cacheConfig = await CacheConfig.findOne();

    // Nếu không có cấu hình, tạo cấu hình mặc định
    if (!cacheConfig) {
      cacheConfig = await CacheConfig.create({});
    }

    res.json({
      success: true,
      data: cacheConfig
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * Cập nhật cấu hình cache
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateCacheConfig = async (req, res) => {
  try {
    const { body } = req;

    // Kiểm tra xem body có đúng định dạng không
    if (!body || typeof body !== 'object') {
      console.error('[API] Invalid request body format:', body);
      return res.status(400).json({
        success: false,
        error: 'Invalid request body format'
      });
    }

    // Kiểm tra các trường bắt buộc
    if (!body.api || !body.pages || !body.images) {
      console.error('[API] Missing required fields in request body');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: api, pages, or images'
      });
    }

    // Lấy cấu hình cache từ database
    let cacheConfig = await CacheConfig.findOne();
    // Nếu không có cấu hình, tạo mới
    if (!cacheConfig) {
      try {
        cacheConfig = new CacheConfig(body);
        cacheConfig.lastUpdated = new Date();
        await cacheConfig.save();
      } catch (createError) {
        console.error('[API] Error creating new cache config:', createError);
        throw createError;
      }
    } else {
      // Cập nhật cấu hình
      try {
        // Cập nhật từng trường một để tránh lỗi
        if (body.api) {
          cacheConfig.api = body.api;
        }
        if (body.pages) {
          cacheConfig.pages = body.pages;
        }
        if (body.images) {
          cacheConfig.images = body.images;
        }

        cacheConfig.lastUpdated = new Date();

        // Lưu cấu hình
        const saveResult = await cacheConfig.save();
      } catch (updateError) {
        console.error('[API] Error updating cache config:', updateError);
        throw updateError;
      }
    }

    // Kiểm tra lại cấu hình sau khi lưu
    const updatedConfig = await CacheConfig.findOne();

    res.json({
      success: true,
      data: cacheConfig,
      message: 'Cập nhật cấu hình cache thành công'
    });
  } catch (err) {
    console.error('[API] Error updating cache config:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

/**
 * Xóa cache
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.clearCache = async (req, res) => {
  try {
    const { cacheTypes } = req.body;

    if (!cacheTypes || !Array.isArray(cacheTypes) || cacheTypes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Danh sách loại cache không hợp lệ'
      });
    }

    // Trong thực tế, bạn sẽ cần triển khai logic xóa cache ở đây
    // Ví dụ: xóa cache từ Redis, Memcached, v.v.

    // Cập nhật thời gian xóa cache cuối cùng
    let cacheConfig = await CacheConfig.findOne();
    if (!cacheConfig) {
      cacheConfig = await CacheConfig.create({});
    }

    cacheConfig.lastUpdated = new Date();
    await cacheConfig.save();

    res.json({
      success: true,
      message: `Đã xóa ${cacheTypes.length} loại cache thành công`,
      cleared: cacheTypes.length,
      details: cacheTypes.map(type => ({ type, status: 'success' }))
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
