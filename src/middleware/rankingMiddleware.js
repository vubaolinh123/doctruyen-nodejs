/**
 * Middleware để đảm bảo ranking data luôn sẵn sàng
 * Kiểm tra và khởi tạo ranking nếu cần thiết trước khi xử lý request
 */

const RankingInitializer = require('../services/ranking/rankingInitializer');
const StoryRankings = require('../models/storyRankings');
const moment = require('moment');

// Cache để tránh kiểm tra liên tục
let lastCheckTime = null;
let rankingStatus = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 phút

/**
 * Middleware kiểm tra ranking readiness
 * Tự động khởi tạo ranking nếu chưa có dữ liệu
 */
const ensureRankingReady = async (req, res, next) => {
  try {
    const now = Date.now();
    
    // Kiểm tra cache
    if (lastCheckTime && (now - lastCheckTime) < CACHE_DURATION && rankingStatus?.ready) {
      return next();
    }

    // Kiểm tra dữ liệu ranking hiện tại
    const today = moment().startOf('day').toDate();
    const existingRankings = await StoryRankings.countDocuments({
      date: {
        $gte: moment(today).startOf('day').toDate(),
        $lte: moment(today).endOf('day').toDate()
      }
    });

    // Nếu không có dữ liệu ranking, khởi tạo ngay
    if (existingRankings === 0) {
      console.log('[Ranking Middleware] No ranking data found, initializing...');
      
      const initResult = await RankingInitializer.initializeOnStartup();
      
      if (!initResult.success) {
        console.error('[Ranking Middleware] Failed to initialize rankings:', initResult.error);
        // Vẫn cho phép request tiếp tục, chỉ log lỗi
      } else {
        console.log('[Ranking Middleware] Rankings initialized successfully');
      }
    }

    // Cập nhật cache
    lastCheckTime = now;
    rankingStatus = { ready: true };
    
    next();
  } catch (error) {
    console.error('[Ranking Middleware] Error ensuring ranking readiness:', error);
    // Không block request, chỉ log lỗi
    next();
  }
};

/**
 * Middleware chỉ áp dụng cho ranking endpoints
 * Đảm bảo có dữ liệu trước khi trả về kết quả
 */
const validateRankingData = async (req, res, next) => {
  try {
    const today = moment().startOf('day').toDate();
    
    // Kiểm tra endpoint nào đang được gọi
    const endpoint = req.route?.path;
    let rankingType = null;
    
    if (endpoint?.includes('daily')) rankingType = 'daily';
    else if (endpoint?.includes('weekly')) rankingType = 'weekly';
    else if (endpoint?.includes('monthly')) rankingType = 'monthly';
    else if (endpoint?.includes('all-time')) rankingType = 'all-time';

    if (rankingType) {
      // Kiểm tra dữ liệu cho loại ranking cụ thể
      const query = {
        date: {
          $gte: moment(today).startOf('day').toDate(),
          $lte: moment(today).endOf('day').toDate()
        }
      };

      // Thêm điều kiện cho từng loại ranking
      switch (rankingType) {
        case 'daily':
          query.daily_rank = { $gt: 0 };
          break;
        case 'weekly':
          query.weekly_rank = { $gt: 0 };
          break;
        case 'monthly':
          query.monthly_rank = { $gt: 0 };
          break;
        case 'all-time':
          query.all_time_rank = { $gt: 0 };
          break;
      }

      const count = await StoryRankings.countDocuments(query);
      
      if (count === 0) {
        console.log(`[Ranking Middleware] No ${rankingType} ranking data found, attempting to create...`);
        
        // Thử khởi tạo lại
        const initResult = await RankingInitializer.initializeOnStartup();
        
        if (!initResult.success) {
          return res.status(503).json({
            success: false,
            message: `${rankingType} ranking data is not available`,
            error: 'Ranking system is initializing, please try again later'
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('[Ranking Middleware] Error validating ranking data:', error);
    next(); // Không block request
  }
};

/**
 * Middleware để clear cache khi có update ranking
 */
const clearRankingCache = (req, res, next) => {
  // Clear cache sau khi update ranking
  const originalSend = res.send;
  res.send = function(data) {
    // Nếu là response thành công từ update ranking
    if (res.statusCode === 200 && req.route?.path?.includes('update')) {
      lastCheckTime = null;
      rankingStatus = null;
      console.log('[Ranking Middleware] Ranking cache cleared after update');
    }
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Middleware để log ranking performance
 */
const logRankingPerformance = (req, res, next) => {
  const startTime = Date.now();
  
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Log performance cho ranking endpoints
    if (req.route?.path?.includes('rankings')) {
      console.log(`[Ranking Performance] ${req.method} ${req.originalUrl} - ${duration}ms`);
      
      // Warn nếu quá chậm
      if (duration > 1000) {
        console.warn(`[Ranking Performance] Slow ranking query detected: ${duration}ms`);
      }
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  ensureRankingReady,
  validateRankingData,
  clearRankingCache,
  logRankingPerformance
};
