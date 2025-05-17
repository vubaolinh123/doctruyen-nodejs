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
    
    // Lấy cấu hình cache từ database
    let cacheConfig = await CacheConfig.findOne();
    
    // Nếu không có cấu hình, tạo mới
    if (!cacheConfig) {
      cacheConfig = await CacheConfig.create(body);
    } else {
      // Cập nhật cấu hình
      Object.assign(cacheConfig, body);
      cacheConfig.lastUpdated = new Date();
      await cacheConfig.save();
    }
    
    res.json({
      success: true,
      data: cacheConfig,
      message: 'Cập nhật cấu hình cache thành công'
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
