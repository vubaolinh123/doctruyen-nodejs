/**
 * Attendance Reward Controller
 * Handles HTTP requests and responses for attendance reward operations
 * Refactored to maintain backward compatibility while improving code structure
 */

const attendanceRewardService = require('../services/attendanceRewardService');
const { handleApiError } = require('../utils/errorHandler');

/**
 * Get list of available rewards for user
 */
const getRewardsList = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await attendanceRewardService.getRewardsList(userId);

    res.json({
      success: true,
      message: 'Lấy danh sách phần thưởng thành công',
      data: result
    });
  } catch (error) {
    console.error('[AttendanceRewardController] Error in getRewardsList:', error);
    handleApiError(res, error, 'Lỗi khi lấy danh sách phần thưởng');
  }
};

/**
 * Claim a specific reward
 */
const claimReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rewardId } = req.params;

    const result = await attendanceRewardService.claimReward(userId, rewardId);

    res.json({
      success: true,
      message: 'Nhận thưởng thành công!',
      data: result
    });
  } catch (error) {
    console.error('[AttendanceRewardController] Error in claimReward:', error);
    handleApiError(res, error, 'Lỗi khi nhận thưởng');
  }
};

/**
 * Get pricing for buying missed attendance days
 */
const getBuyMissedDaysPricing = async (req, res) => {
  try {
    const result = await attendanceRewardService.getBuyMissedDaysPricing();

    res.json({
      success: true,
      message: 'Lấy thông tin giá thành công',
      data: result
    });
  } catch (error) {
    console.error('[AttendanceRewardController] Error in getBuyMissedDaysPricing:', error);
    handleApiError(res, error, 'Lỗi khi lấy thông tin giá');
  }
};

/**
 * Get available missed days for purchase
 */
const getAvailableMissedDays = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await attendanceRewardService.getAvailableMissedDays(userId);

    res.json({
      success: true,
      message: 'Lấy danh sách ngày có thể mua thành công',
      data: result
    });
  } catch (error) {
    console.error('[AttendanceRewardController] Error in getAvailableMissedDays:', error);
    handleApiError(res, error, 'Lỗi khi lấy danh sách ngày có thể mua');
  }
};

/**
 * Buy missed attendance days
 */
const buyMissedDays = async (req, res) => {
  try {
    const userId = req.user.id;
    const { missed_dates } = req.body; // ✅ Fixed: Use missed_dates to match route validation

    console.log(`[AttendanceRewardController] buyMissedDays called for user ${userId}`);
    console.log(`[AttendanceRewardController] missed_dates:`, missed_dates);

    const result = await attendanceRewardService.buyMissedDays(userId, missed_dates);

    res.json({
      success: true,
      message: `Mua thành công ${result.purchasedCount} ngày điểm danh`,
      data: result
    });
  } catch (error) {
    console.error('[AttendanceRewardController] Error in buyMissedDays:', error);
    handleApiError(res, error, 'Lỗi khi mua ngày điểm danh');
  }
};

module.exports = {
  getRewardsList,
  claimReward,
  getBuyMissedDaysPricing,
  getAvailableMissedDays,
  buyMissedDays
};
