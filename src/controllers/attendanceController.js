const Attendance = require('../models/Attendance');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

/**
 * Lấy lịch sử điểm danh của người dùng theo tháng
 * @route GET /api/attendance
 */
exports.getAttendanceHistory = async (req, res) => {
  try {
    const { month, year } = req.query;
    const customerId = req.user.id;

    // Validate input
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }

    // Chuyển đổi tháng và năm thành số
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Validate tháng và năm
    if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 0 || monthNum > 11) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month or year'
      });
    }

    // Lấy thông tin người dùng
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Lấy lịch sử điểm danh trong tháng
    const attendanceRecords = await Attendance.find({
      customer_id: customerId,
      month: monthNum,
      year: yearNum
    }).sort({ day: 1 });

    // Tạo dữ liệu điểm danh cho tháng
    const daysInMonth = new Date(yearNum, monthNum + 1, 0).getDate();
    const attendanceData = {};
    
    // Sử dụng múi giờ Việt Nam (GMT+7)
    const today = new Date();
    const vietnamTime = new Date(today.getTime() + (7 * 60 * 60 * 1000));
    const currentDate = vietnamTime.getDate();
    const currentMonth = vietnamTime.getMonth();
    const currentYear = vietnamTime.getFullYear();

    // Khởi tạo dữ liệu mặc định
    for (let i = 1; i <= daysInMonth; i++) {
      // Ngày trong tương lai
      if (
        (monthNum === currentMonth && yearNum === currentYear && i > currentDate) ||
        (monthNum > currentMonth && yearNum === currentYear) ||
        yearNum > currentYear
      ) {
        attendanceData[i] = 'future';
      } else {
        // Ngày trong quá khứ hoặc hiện tại, mặc định là missed
        attendanceData[i] = 'missed';
      }
    }

    // Cập nhật dữ liệu từ records
    attendanceRecords.forEach(record => {
      if (record.status === 'attended') {
        attendanceData[record.day] = 'attended';
      }
    });

    // Nếu là ngày hiện tại và chưa điểm danh
    if (
      monthNum === currentMonth &&
      yearNum === currentYear &&
      attendanceData[currentDate] === 'missed' &&
      !customer.attendance_summary.today_attended
    ) {
      attendanceData[currentDate] = 'pending';
    }

    // Kiểm tra xem ngày hôm qua có điểm danh không để xác định số ngày liên tiếp
    let consecutiveDays = customer.attendance_summary.current_streak || 0;
    if (customer.attendance_summary.last_attendance) {
      const lastDate = new Date(customer.attendance_summary.last_attendance);
      const yesterday = new Date(vietnamTime);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      if (lastDate.getTime() !== yesterday.getTime()) {
        consecutiveDays = 0;
      }
    }

    return res.json({
      success: true,
      data: {
        attendanceData,
        stats: {
          totalDaysAttended: customer.attendance_summary.total_days || 0,
          consecutiveDays: consecutiveDays,
          maxConsecutiveDays: customer.attendance_summary.longest_streak || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Điểm danh hàng ngày
 * @route POST /api/attendance
 */
exports.checkIn = async (req, res) => {
  try {
    const customerId = req.user.id;
    // Sử dụng múi giờ Việt Nam (GMT+7)
    const today = new Date();
    const vietnamTime = new Date(today.getTime() + (7 * 60 * 60 * 1000));
    vietnamTime.setHours(0, 0, 0, 0);

    const day = vietnamTime.getDate();
    const month = vietnamTime.getMonth();
    const year = vietnamTime.getFullYear();

    // Lấy thông tin người dùng
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Kiểm tra xem đã điểm danh hôm nay chưa
    if (customer.attendance_summary.last_attendance) {
      const lastDate = new Date(customer.attendance_summary.last_attendance);
      lastDate.setHours(0, 0, 0, 0);

      if (lastDate.getTime() === vietnamTime.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã điểm danh hôm nay rồi'
        });
      }
    }

    // Tính toán số ngày liên tiếp
    let consecutiveDays = customer.attendance_summary.current_streak || 0;
    const lastDate = customer.attendance_summary.last_attendance
      ? new Date(customer.attendance_summary.last_attendance)
      : null;

    // Nếu ngày cuối cùng điểm danh là ngày hôm qua, tăng số ngày liên tiếp
    if (lastDate) {
      const yesterday = new Date(vietnamTime);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      if (lastDate.getTime() === yesterday.getTime()) {
        consecutiveDays++;
      } else {
        // Nếu không phải ngày hôm qua, reset về 1
        consecutiveDays = 1;
      }
    } else {
      // Nếu chưa có ngày điểm danh nào, đặt là 1
      consecutiveDays = 1;
    }

    // Cập nhật số ngày liên tiếp cao nhất
    const maxConsecutiveDays = Math.max(
      customer.attendance_summary.longest_streak || 0,
      consecutiveDays
    );

    // Cập nhật thông tin điểm danh của người dùng
    customer.attendance_summary.total_days = (customer.attendance_summary.total_days || 0) + 1;
    customer.attendance_summary.current_streak = consecutiveDays;
    customer.attendance_summary.longest_streak = maxConsecutiveDays;
    customer.attendance_summary.last_attendance = vietnamTime;
    customer.attendance_summary.today_attended = true;

    // Tính toán phần thưởng
    let reward = 10;
    let bonusReward = 0;

    if (consecutiveDays === 7) {
      bonusReward = 100;
    } else if (consecutiveDays === 15) {
      bonusReward = 250;
    } else if (consecutiveDays === 30) {
      bonusReward = 1000;
    } else if (consecutiveDays % 30 === 0 && consecutiveDays > 30) {
      bonusReward = 1000;
    }

    // Cập nhật số xu
    customer.coin = (customer.coin || 0) + (reward + bonusReward);
    customer.coin_total = (customer.coin_total || 0) + (reward + bonusReward);

    // Lưu thông tin người dùng
    await customer.save();

    // Tạo bản ghi điểm danh mới
    const attendance = new Attendance({
      customer_id: customerId,
      date: vietnamTime,
      day,
      month,
      year,
      status: 'attended',
      streak_count: consecutiveDays,
      reward,
      bonus_reward: bonusReward
    });

    await attendance.save();

    // Trả về thông tin điểm danh
    return res.json({
      success: true,
      message: 'Điểm danh thành công',
      data: {
        attendance: {
          id: attendance._id,
          date: vietnamTime,
          reward,
          streak_count: consecutiveDays,
          bonus_reward: bonusReward
        },
        stats: {
          totalDaysAttended: customer.attendance_summary.total_days,
          consecutiveDays: customer.attendance_summary.current_streak,
          maxConsecutiveDays: customer.attendance_summary.longest_streak
        }
      }
    });
  } catch (error) {
    console.error('Error recording attendance:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Cập nhật trạng thái missed cho các ngày bỏ lỡ
 * Chạy hàng ngày bằng cron job
 */
exports.updateMissedDays = async () => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const day = yesterday.getDate();
    const month = yesterday.getMonth();
    const year = yesterday.getFullYear();

    // Lấy tất cả người dùng có last_attendance_date khác với ngày hôm qua
    const customers = await Customer.find({
      $or: [
        { 'attendance_summary.last_attendance_date': { $lt: yesterday } },
        { 'attendance_summary.last_attendance_date': null }
      ]
    });

    // Tạo bản ghi missed cho mỗi người dùng
    for (const customer of customers) {
      // Kiểm tra xem đã có bản ghi cho ngày hôm qua chưa
      const existingRecord = await Attendance.findOne({
        customer_id: customer._id,
        day,
        month,
        year
      });

      if (!existingRecord) {
        // Tạo bản ghi missed
        await Attendance.createMissedAttendance(customer._id, yesterday);

        // Reset số ngày liên tiếp
        customer.attendance_summary.consecutive_days = 0;
        customer.attendance_summary.today_attended = false;
        await customer.save();
      }
    }

    console.log(`Updated missed days for ${customers.length} users`);
    return true;
  } catch (error) {
    console.error('Error updating missed days:', error);
    return false;
  }
};
