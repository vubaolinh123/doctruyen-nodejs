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
    const today = new Date();
    const currentDate = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

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
      attendanceData[record.day] = record.status;
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

    return res.json({
      success: true,
      data: {
        attendanceData,
        stats: {
          totalDaysAttended: customer.attendance_summary.total_days || 0,
          consecutiveDays: customer.attendance_summary.consecutive_days || 0,
          maxConsecutiveDays: customer.attendance_summary.max_consecutive_days || 0
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const day = today.getDate();
    const month = today.getMonth();
    const year = today.getFullYear();

    // Lấy thông tin người dùng
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Kiểm tra xem đã điểm danh hôm nay chưa
    if (customer.attendance_summary.last_attendance_date) {
      const lastDate = new Date(customer.attendance_summary.last_attendance_date);
      lastDate.setHours(0, 0, 0, 0);

      if (lastDate.getTime() === today.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'You have already checked in today'
        });
      }
    }

    // Tính toán số ngày liên tiếp
    let consecutiveDays = customer.attendance_summary.consecutive_days || 0;
    const lastDate = customer.attendance_summary.last_attendance_date
      ? new Date(customer.attendance_summary.last_attendance_date)
      : null;

    // Nếu ngày cuối cùng điểm danh là ngày hôm qua, tăng số ngày liên tiếp
    if (lastDate) {
      const yesterday = new Date(today);
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
      customer.attendance_summary.max_consecutive_days || 0,
      consecutiveDays
    );

    // Tính toán phần thưởng cơ bản và phần thưởng bổ sung
    const baseReward = 10;
    let bonusReward = 0;

    // Thưởng thêm nếu đạt mốc
    if (consecutiveDays === 7) {
      bonusReward = 100;
    } else if (consecutiveDays === 15) {
      bonusReward = 250;
    } else if (consecutiveDays === 30) {
      bonusReward = 1000;
    } else if (consecutiveDays % 30 === 0 && consecutiveDays > 30) {
      bonusReward = 1000;
    }

    const totalReward = baseReward + bonusReward;

    // Tạo ghi chú cho bản ghi điểm danh
    let notes = '';
    if (bonusReward > 0) {
      notes = `Điểm danh ${consecutiveDays} ngày liên tiếp! Thưởng thêm ${bonusReward} xu.`;
    }

    // Tạo bản ghi điểm danh mới
    const attendance = new Attendance({
      customer_id: customerId,
      date: today,
      status: 'attended',
      reward: totalReward,
      day,
      month,
      year,
      streak_count: consecutiveDays,
      bonus_reward: bonusReward,
      notes
    });

    await attendance.save();

    // Cập nhật thông tin người dùng
    customer.attendance_summary.total_days = (customer.attendance_summary.total_days || 0) + 1;
    customer.attendance_summary.consecutive_days = consecutiveDays;
    customer.attendance_summary.max_consecutive_days = maxConsecutiveDays;
    customer.attendance_summary.last_attendance_date = today;
    customer.attendance_summary.today_attended = true;

    // Cập nhật trường cũ để tương thích ngược
    customer.diem_danh = customer.attendance_summary.total_days;
    customer.check_in_date = today;

    // Cộng xu
    customer.coin += totalReward;
    customer.coin_total += totalReward;

    await customer.save();

    // Tạo giao dịch
    const transactionData = {
      customer_id: customerId,
      amount: totalReward,
      description: `Điểm danh ngày ${day}/${month + 1}/${year}${bonusReward > 0 ? ` (Chuỗi ${consecutiveDays} ngày)` : ''}`,
      coin_change: totalReward,
      type: 'attendance',
      reference_type: 'attendance',
      reference_id: attendance._id,
      metadata: {
        streak_count: consecutiveDays,
        base_reward: baseReward,
        bonus_reward: bonusReward
      }
    };

    await Transaction.createTransaction(transactionData);

    return res.json({
      success: true,
      message: 'Attendance recorded successfully',
      reward: totalReward,
      bonus_reward: bonusReward,
      stats: {
        totalDaysAttended: customer.attendance_summary.total_days,
        consecutiveDays: customer.attendance_summary.consecutive_days,
        maxConsecutiveDays: customer.attendance_summary.max_consecutive_days
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
