const userService = require('../../services/user/userService');

/**
 * Lấy thống kê đăng ký người dùng
 * @route GET /api/users/analytics/registration-stats
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRegistrationStats = async (req, res) => {
  try {
    const {
      period = 'daily', // daily, monthly, yearly
      days = 30,        // Số ngày gần đây (cho daily)
      months = 12,      // Số tháng gần đây (cho monthly)
      years = 5,        // Số năm gần đây (cho yearly)
      startDate,        // Custom start date
      endDate,          // Custom end date
      timezone = 'Asia/Ho_Chi_Minh'
    } = req.query;

    let stats;

    if (startDate && endDate) {
      // Custom date range
      stats = await userService.getRegistrationStatsCustomRange(
        new Date(startDate),
        new Date(endDate),
        period,
        timezone
      );
    } else {
      // Predefined periods
      switch (period) {
        case 'daily':
          stats = await userService.getRegistrationStatsDaily(parseInt(days), timezone);
          break;
        case 'monthly':
          stats = await userService.getRegistrationStatsMonthly(parseInt(months), timezone);
          break;
        case 'yearly':
          stats = await userService.getRegistrationStatsYearly(parseInt(years), timezone);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid period. Must be daily, monthly, or yearly'
          });
      }
    }

    res.json({
      success: true,
      data: {
        period,
        timezone,
        stats,
        summary: {
          totalRegistrations: stats.reduce((sum, item) => sum + item.count, 0),
          averagePerPeriod: stats.length > 0 ? 
            Math.round(stats.reduce((sum, item) => sum + item.count, 0) / stats.length) : 0,
          peakRegistration: stats.length > 0 ? 
            Math.max(...stats.map(item => item.count)) : 0,
          dataPoints: stats.length
        }
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê đăng ký:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy thống kê tổng quan đăng ký
 * @route GET /api/users/analytics/registration-overview
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRegistrationOverview = async (req, res) => {
  try {
    const { timezone = 'Asia/Ho_Chi_Minh' } = req.query;

    const overview = await userService.getRegistrationOverview(timezone);

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Lỗi khi lấy tổng quan đăng ký:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy thống kê đăng ký theo account type
 * @route GET /api/users/analytics/registration-by-type
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRegistrationByType = async (req, res) => {
  try {
    const {
      period = 'monthly',
      months = 12,
      timezone = 'Asia/Ho_Chi_Minh'
    } = req.query;

    const stats = await userService.getRegistrationStatsByAccountType(
      period,
      parseInt(months),
      timezone
    );

    res.json({
      success: true,
      data: {
        period,
        timezone,
        stats
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê đăng ký theo loại tài khoản:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy thống kê growth rate
 * @route GET /api/users/analytics/growth-rate
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getGrowthRate = async (req, res) => {
  try {
    const {
      period = 'monthly',
      periods = 12,
      timezone = 'Asia/Ho_Chi_Minh'
    } = req.query;

    const growthStats = await userService.getRegistrationGrowthRate(
      period,
      parseInt(periods),
      timezone
    );

    res.json({
      success: true,
      data: {
        period,
        timezone,
        growthStats
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê tăng trưởng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};
