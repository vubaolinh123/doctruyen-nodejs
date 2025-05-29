/**
 * Attendance Controller
 * Handles HTTP requests and responses for attendance operations
 * Refactored from existing routes to follow MVC pattern
 */

const attendanceService = require('../services/attendanceService');
const { handleApiError, ApiError } = require('../utils/errorHandler');

/**
 * @desc Check in attendance for current day
 * @route POST /api/attendance/checkin
 * @access User
 */
const checkIn = async (req, res) => {
  try {
    console.log(`[AttendanceController] Check-in request from user: ${req.user.id}`);
    
    const userId = req.user.id;
    const result = await attendanceService.checkIn(userId);
    
    console.log(`[AttendanceController] Check-in successful for user: ${userId}`);
    
    res.json({
      success: true,
      message: 'Điểm danh thành công!',
      data: result
    });
  } catch (error) {
    console.error('[AttendanceController] Error in checkIn:', error);
    handleApiError(res, error, 'Lỗi khi điểm danh');
  }
};

/**
 * @desc Get attendance status for current day
 * @route GET /api/attendance/status
 * @access User
 */
const getAttendanceStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await attendanceService.getAttendanceStatus(userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[AttendanceController] Error in getAttendanceStatus:', error);
    handleApiError(res, error, 'Lỗi khi lấy trạng thái điểm danh');
  }
};

/**
 * @desc Get attendance history for user
 * @route GET /api/attendance/history
 * @access User
 */
const getAttendanceHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year, limit = 31, page = 1 } = req.query;
    
    const options = {
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
      limit: parseInt(limit),
      page: parseInt(page)
    };
    
    const result = await attendanceService.getAttendanceHistory(userId, options);
    
    res.json({
      success: true,
      message: 'Lấy lịch sử điểm danh thành công',
      data: result
    });
  } catch (error) {
    console.error('[AttendanceController] Error in getAttendanceHistory:', error);
    handleApiError(res, error, 'Lỗi khi lấy lịch sử điểm danh');
  }
};

/**
 * @desc Get attendance statistics for user
 * @route GET /api/attendance/stats
 * @access User
 */
const getAttendanceStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year } = req.query;
    
    const result = await attendanceService.getAttendanceStats(userId, year ? parseInt(year) : undefined);
    
    res.json({
      success: true,
      message: 'Lấy thống kê điểm danh thành công',
      data: result
    });
  } catch (error) {
    console.error('[AttendanceController] Error in getAttendanceStats:', error);
    handleApiError(res, error, 'Lỗi khi lấy thống kê điểm danh');
  }
};

/**
 * @desc Get attendance calendar for specific month
 * @route GET /api/attendance/calendar
 * @access User
 */
const getAttendanceCalendar = async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;
    
    if (!month || !year) {
      throw new ApiError(400, 'Tháng và năm là bắt buộc');
    }
    
    const result = await attendanceService.getAttendanceCalendar(userId, parseInt(month), parseInt(year));
    
    res.json({
      success: true,
      message: 'Lấy lịch điểm danh thành công',
      data: result
    });
  } catch (error) {
    console.error('[AttendanceController] Error in getAttendanceCalendar:', error);
    handleApiError(res, error, 'Lỗi khi lấy lịch điểm danh');
  }
};

/**
 * @desc Get user's attendance summary
 * @route GET /api/attendance/summary
 * @access User
 */
const getAttendanceSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await attendanceService.getAttendanceSummary(userId);
    
    res.json({
      success: true,
      message: 'Lấy tổng quan điểm danh thành công',
      data: result
    });
  } catch (error) {
    console.error('[AttendanceController] Error in getAttendanceSummary:', error);
    handleApiError(res, error, 'Lỗi khi lấy tổng quan điểm danh');
  }
};

/**
 * @desc Get available missed days for purchase
 * @route GET /api/attendance/missed-days
 * @access User
 */
const getAvailableMissedDays = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await attendanceService.getAvailableMissedDays(userId);
    
    res.json({
      success: true,
      message: 'Lấy danh sách ngày có thể mua thành công',
      data: result
    });
  } catch (error) {
    console.error('[AttendanceController] Error in getAvailableMissedDays:', error);
    handleApiError(res, error, 'Lỗi khi lấy danh sách ngày có thể mua');
  }
};

/**
 * @desc Buy missed attendance days
 * @route POST /api/attendance/buy-missed-days
 * @access User
 */
const buyMissedDays = async (req, res) => {
  try {
    const userId = req.user.id;
    const { missed_dates } = req.body;
    
    if (!Array.isArray(missed_dates) || missed_dates.length === 0) {
      throw new ApiError(400, 'Danh sách ngày không hợp lệ');
    }
    
    const result = await attendanceService.buyMissedDays(userId, missed_dates);
    
    res.json({
      success: true,
      message: `Mua thành công ${result.purchasedCount} ngày điểm danh`,
      data: result
    });
  } catch (error) {
    console.error('[AttendanceController] Error in buyMissedDays:', error);
    handleApiError(res, error, 'Lỗi khi mua ngày điểm danh');
  }
};

module.exports = {
  checkIn,
  getAttendanceStatus,
  getAttendanceHistory,
  getAttendanceStats,
  getAttendanceCalendar,
  getAttendanceSummary,
  getAvailableMissedDays,
  buyMissedDays
};
