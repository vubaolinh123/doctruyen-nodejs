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
    const { month, year, timezone, timezoneOffset } = req.query;
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

    // Lấy ngày hiện tại theo múi giờ của người dùng
    let currentDate, currentMonth, currentYear;

    // Ghi log tóm tắt về thông tin múi giờ
    console.log(`Using timezone: ${timezone || 'Not provided'}, offset: ${timezoneOffset || 'Not provided'}`);

    if (timezone && timezoneOffset !== undefined) {
      // Sử dụng múi giờ của người dùng
      // Đảm bảo timezoneOffset là số
      const offsetValue = typeof timezoneOffset === 'string' ? parseInt(timezoneOffset) : timezoneOffset;
      const offsetInMs = offsetValue * 60 * 1000;
      const today = new Date();

      // Tính toán thời gian theo múi giờ của người dùng
      // Lưu ý: getTimezoneOffset() trả về số phút lệch so với UTC, và giá trị là âm cho múi giờ phía đông UTC
      // Vì vậy, chúng ta cần đảo ngược dấu của offsetInMs
      const userLocalTime = new Date(today.getTime() - offsetInMs);

      currentDate = userLocalTime.getDate();
      currentMonth = userLocalTime.getMonth();
      currentYear = userLocalTime.getFullYear();

      // Đã tính toán thời gian theo múi giờ người dùng
    } else {
      // Fallback: Sử dụng múi giờ Việt Nam (GMT+7) nếu không có thông tin múi giờ
      const today = new Date();
      const vietnamTime = new Date(today.getTime() + (7 * 60 * 60 * 1000));
      currentDate = vietnamTime.getDate();
      currentMonth = vietnamTime.getMonth();
      currentYear = vietnamTime.getFullYear();

      // Fallback đến múi giờ Việt Nam
    }

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

    // Log tổng quan về dữ liệu ngày thay vì log từng ngày
    console.log(`Initialized ${daysInMonth} days for month ${monthNum + 1}/${yearNum}`);
    console.log(`Current date: ${currentDate}/${currentMonth + 1}/${currentYear}`);


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

      // Sử dụng biến userLocalTime thay vì vietnamTime
      const yesterday = new Date();
      if (timezone && timezoneOffset !== undefined) {
        // Nếu có thông tin múi giờ, sử dụng múi giờ của người dùng
        // Đảm bảo timezoneOffset là số
        const offsetValue = typeof timezoneOffset === 'string' ? parseInt(timezoneOffset) : timezoneOffset;
        const offsetInMs = offsetValue * 60 * 1000;
        const today = new Date();
        const userTime = new Date(today.getTime() - offsetInMs);
        yesterday.setTime(userTime.getTime());

        // Đã tính toán ngày hôm qua theo múi giờ người dùng
      } else {
        // Fallback: Sử dụng múi giờ Việt Nam (GMT+7)
        const today = new Date();
        yesterday.setTime(today.getTime() + (7 * 60 * 60 * 1000));
        // Fallback đến múi giờ Việt Nam
      }

      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Kiểm tra xem lần điểm danh cuối cùng có phải là ngày hôm qua không

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
    const { date, timezone, timezoneOffset } = req.body;

    // Ghi log tóm tắt về thông tin múi giờ
    console.log(`Check-in request from user ${customerId} with timezone: ${timezone || 'Not provided'}, offset: ${timezoneOffset || 'Not provided'}`);

    let userLocalTime;

    if (date && timezone && timezoneOffset !== undefined) {
      // Sử dụng múi giờ của người dùng
      // Đảm bảo timezoneOffset là số
      const offsetValue = typeof timezoneOffset === 'string' ? parseInt(timezoneOffset) : timezoneOffset;
      const offsetInMs = offsetValue * 60 * 1000;
      const clientDate = new Date(date);

      // Tính toán thời gian theo múi giờ của người dùng
      userLocalTime = new Date(clientDate);
      userLocalTime.setHours(0, 0, 0, 0);

      // Đã tính toán thời gian theo múi giờ người dùng
    } else {
      // Fallback: Sử dụng múi giờ Việt Nam (GMT+7)
      const today = new Date();
      userLocalTime = new Date(today.getTime() + (7 * 60 * 60 * 1000));
      userLocalTime.setHours(0, 0, 0, 0);

      // Fallback đến múi giờ Việt Nam
    }

    const day = userLocalTime.getDate();
    const month = userLocalTime.getMonth();
    const year = userLocalTime.getFullYear();

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

      // So sánh ngày, tháng, năm thay vì so sánh timestamp
      const lastDay = lastDate.getDate();
      const lastMonth = lastDate.getMonth();
      const lastYear = lastDate.getFullYear();

      // Kiểm tra xem đã điểm danh hôm nay chưa

      if (lastDay === day && lastMonth === month && lastYear === year) {
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
      // Tính toán ngày hôm qua dựa trên ngày hiện tại của người dùng
      const yesterday = new Date(userLocalTime);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Lấy ngày, tháng, năm của ngày hôm qua
      const yesterdayDay = yesterday.getDate();
      const yesterdayMonth = yesterday.getMonth();
      const yesterdayYear = yesterday.getFullYear();

      // Lấy ngày, tháng, năm của lần điểm danh cuối cùng
      const lastDay = lastDate.getDate();
      const lastMonth = lastDate.getMonth();
      const lastYear = lastDate.getFullYear();

      // Kiểm tra xem lần điểm danh cuối cùng có phải là ngày hôm qua không

      // So sánh ngày, tháng, năm thay vì so sánh timestamp
      if (lastDay === yesterdayDay && lastMonth === yesterdayMonth && lastYear === yesterdayYear) {
        consecutiveDays++;
        // Tăng số ngày liên tiếp
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
    customer.attendance_summary.last_attendance = userLocalTime;
    customer.attendance_summary.today_attended = true;

    // Lưu thông tin múi giờ của người dùng nếu có
    if (timezone) {
      customer.timezone = timezone;
    }
    if (timezoneOffset !== undefined) {
      // Đảm bảo timezoneOffset là số
      const offsetValue = typeof timezoneOffset === 'string' ? parseInt(timezoneOffset) : timezoneOffset;
      customer.timezone_offset = offsetValue;
      // Lưu timezone_offset vào database
    }

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

    // Tổng số xu thưởng
    const totalCoins = reward + bonusReward;

    // Cập nhật số xu
    customer.coin = (customer.coin || 0) + totalCoins;
    customer.coin_total = (customer.coin_total || 0) + totalCoins;

    // Tạo bản ghi giao dịch (transaction) cho việc điểm danh
    const transactionData = {
      customer_id: customerId,
      transaction_id: `ATTENDANCE_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      amount: 0, // Giao dịch điểm danh không liên quan đến tiền
      description: bonusReward > 0
        ? `Điểm danh ngày thứ ${consecutiveDays} (+${reward} xu cơ bản, +${bonusReward} xu thưởng)`
        : `Điểm danh ngày thứ ${consecutiveDays} (+${reward} xu)`,
      transaction_date: new Date(),
      coin_change: totalCoins, // Số xu thay đổi
      type: 'attendance', // Loại giao dịch là điểm danh
      status: 'completed', // Trạng thái hoàn thành
      reference_type: 'attendance',
      reference_id: null, // Sẽ cập nhật sau khi lưu bản ghi attendance
      metadata: {
        day: day,
        month: month,
        year: year,
        streak_count: consecutiveDays,
        reward: reward,
        bonus_reward: bonusReward
      }
    };

    // Lưu thông tin người dùng
    await customer.save();

    // Tạo bản ghi điểm danh mới
    const attendance = new Attendance({
      customer_id: customerId,
      date: userLocalTime,
      day,
      month,
      year,
      status: 'attended',
      streak_count: consecutiveDays,
      reward,
      bonus_reward: bonusReward,
      timezone: timezone || 'Asia/Ho_Chi_Minh', // Lưu múi giờ của người dùng
      timezone_offset: timezoneOffset !== undefined ?
        (typeof timezoneOffset === 'string' ? parseInt(timezoneOffset) : timezoneOffset) :
        420 // 420 phút = GMT+7
    });

    await attendance.save();

    // Cập nhật reference_id của transaction và lưu transaction
    transactionData.reference_id = attendance._id.toString();
    const transaction = await Transaction.createTransaction(transactionData);

    // Trả về thông tin điểm danh
    return res.json({
      success: true,
      message: 'Điểm danh thành công',
      data: {
        attendance: {
          id: attendance._id,
          date: userLocalTime,
          reward,
          streak_count: consecutiveDays,
          bonus_reward: bonusReward,
          timezone: timezone || 'Asia/Ho_Chi_Minh',
          timezone_offset: timezoneOffset !== undefined ?
            (typeof timezoneOffset === 'string' ? parseInt(timezoneOffset) : timezoneOffset) :
            420
        },
        transaction: {
          id: transaction._id,
          coin_change: totalCoins,
          type: 'attendance'
        },
        stats: {
          totalDaysAttended: customer.attendance_summary.total_days,
          consecutiveDays: customer.attendance_summary.current_streak,
          maxConsecutiveDays: customer.attendance_summary.longest_streak
        },
        user_date: {
          day,
          month,
          year,
          date_string: userLocalTime.toISOString()
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
    // Sử dụng múi giờ Việt Nam (GMT+7) cho cron job
    const today = new Date();
    const vietnamTime = new Date(today.getTime() + (7 * 60 * 60 * 1000));
    const yesterday = new Date(vietnamTime);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const day = yesterday.getDate();
    const month = yesterday.getMonth();
    const year = yesterday.getFullYear();

    // Cập nhật trạng thái missed cho ngày hôm qua

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

    // Đã cập nhật trạng thái missed cho các người dùng
    return true;
  } catch (error) {
    console.error('Error updating missed days:', error);
    return false;
  }
};
