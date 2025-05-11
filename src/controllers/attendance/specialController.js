const attendanceService = require('../../services/attendance/attendanceService');

/**
 * Lấy lịch sử điểm danh của người dùng theo tháng
 * @route GET /api/attendance
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAttendanceHistory = async (req, res) => {
  try {
    const { month, year, timezone, timezoneOffset } = req.query;
    const userId = req.user.id;

    const result = await attendanceService.getAttendanceHistory(
      userId, 
      { month, year, timezone, timezoneOffset }
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử điểm danh:', error);
    
    // Xử lý lỗi validation
    if (error.message === 'Tháng và năm là bắt buộc') {
      return res.status(400).json({
        success: false,
        message: 'Tháng và năm là bắt buộc'
      });
    } else if (error.message === 'Tháng hoặc năm không hợp lệ') {
      return res.status(400).json({
        success: false,
        message: 'Tháng hoặc năm không hợp lệ'
      });
    } else if (error.message === 'Không tìm thấy người dùng') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    } else if (error.message === 'Không thể xem điểm danh của tháng trong tương lai') {
      return res.status(400).json({
        success: false,
        message: 'Không thể xem điểm danh của tháng trong tương lai'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Điểm danh hàng ngày
 * @route POST /api/attendance
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.checkIn = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, timezone, timezoneOffset } = req.body;

    const result = await attendanceService.checkIn(
      userId, 
      { date, timezone, timezoneOffset }
    );

    return res.json({
      success: true,
      message: 'Điểm danh thành công',
      data: result
    });
  } catch (error) {
    console.error('Lỗi khi điểm danh:', error);
    
    // Xử lý lỗi validation
    if (error.message === 'Không tìm thấy người dùng') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    } else if (error.message === 'Bạn đã điểm danh hôm nay rồi') {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã điểm danh hôm nay rồi'
      });
    } else if (error.message === 'Định dạng ngày không hợp lệ') {
      return res.status(400).json({
        success: false,
        message: 'Định dạng ngày không hợp lệ'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Cập nhật trạng thái missed cho các ngày bỏ lỡ
 * Chạy hàng ngày bằng cron job
 * @returns {boolean} Kết quả cập nhật
 */
exports.updateMissedDays = async () => {
  try {
    await attendanceService.updateMissedDays();
    return true;
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái missed:', error);
    return false;
  }
}; 