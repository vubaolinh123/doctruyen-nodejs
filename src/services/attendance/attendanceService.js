const Attendance = require('../../models/attendance');
const User = require('../../models/user');
const Transaction = require('../../models/transaction');
const mongoose = require('mongoose');

/**
 * Service xử lý các tác vụ liên quan đến điểm danh
 */
class AttendanceService {
  /**
   * Lấy lịch sử điểm danh của người dùng theo tháng
   * @param {string} userId - ID của người dùng
   * @param {Object} options - Các tùy chọn
   * @param {number} options.month - Tháng cần lấy lịch sử (0-11)
   * @param {number} options.year - Năm cần lấy lịch sử
   * @param {string} options.timezone - Múi giờ của người dùng
   * @param {number} options.timezoneOffset - Chênh lệch múi giờ (phút)
   * @returns {Object} Dữ liệu điểm danh và thống kê
   */
  async getAttendanceHistory(userId, { month, year, timezone, timezoneOffset }) {
    if (!month || !year) {
      throw new Error('Tháng và năm là bắt buộc');
    }

    // Chuyển đổi tháng và năm thành số
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Validate tháng và năm
    if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 0 || monthNum > 11) {
      throw new Error('Tháng hoặc năm không hợp lệ');
    }

    // Lấy thông tin người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Không tìm thấy người dùng');
    }

    // Lấy lịch sử điểm danh trong tháng
    const attendanceRecords = await Attendance.find({
      user_id: userId,
      month: monthNum,
      year: yearNum
    }).sort({ day: 1 });

    // Tạo dữ liệu điểm danh cho tháng
    const daysInMonth = new Date(yearNum, monthNum + 1, 0).getDate();
    const attendanceData = {};

    // Lấy thời gian người dùng và thông tin ngày hiện tại
    const { userLocalTime, currentDate, currentMonth, currentYear } = this._getUserLocalTime(timezone, timezoneOffset);

    // Đảm bảo rằng tháng và năm được yêu cầu không vượt quá tháng và năm hiện tại
    if (yearNum > currentYear || (yearNum === currentYear && monthNum > currentMonth)) {
      throw new Error('Không thể xem điểm danh của tháng trong tương lai');
    }

    // Lấy ngày hiện tại theo múi giờ Việt Nam
    const todayVietnam = new Date();
    todayVietnam.setHours(0, 0, 0, 0);
    const todayDate = todayVietnam.getDate();
    const todayMonth = todayVietnam.getMonth();
    const todayYear = todayVietnam.getFullYear();

    // Khởi tạo dữ liệu mặc định
    for (let i = 1; i <= daysInMonth; i++) {
      // So sánh ngày
      if (yearNum > todayYear ||
          (yearNum === todayYear && monthNum > todayMonth) ||
          (yearNum === todayYear && monthNum === todayMonth && i > todayDate)) {
        // Ngày trong tương lai
        attendanceData[i] = 'future';
      } else if (yearNum === todayYear && monthNum === todayMonth && i === todayDate) {
        // Ngày hiện tại, mặc định là missed nhưng sẽ được cập nhật thành pending nếu chưa điểm danh
        attendanceData[i] = 'missed';
      } else {
        // Ngày trong quá khứ, mặc định là missed
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
    for (let i = 1; i <= daysInMonth; i++) {
      if (yearNum === todayYear &&
          monthNum === todayMonth &&
          i === todayDate) {
        // Kiểm tra xem ngày này đã được đánh dấu là 'attended' chưa
        if (attendanceData[i] === 'attended') {
          // Đã điểm danh
        } else if (!user.attendance_summary.today_attended) {
          attendanceData[i] = 'pending';
        }
      }
    }

    // Kiểm tra xem ngày hôm qua có điểm danh không để xác định số ngày liên tiếp
    let consecutiveDays = user.attendance_summary.current_streak || 0;
    if (user.attendance_summary.last_attendance) {
      const lastDate = new Date(user.attendance_summary.last_attendance);

      const yesterday = this._getYesterdayDate(timezone, timezoneOffset);

      if (lastDate.getTime() !== yesterday.getTime()) {
        consecutiveDays = 0;
      }
    }

    return {
      attendanceData,
      stats: {
        totalDaysAttended: user.attendance_summary.total_days || 0,
        consecutiveDays: consecutiveDays,
        maxConsecutiveDays: user.attendance_summary.longest_streak || 0
      }
    };
  }

  /**
   * Thực hiện điểm danh hàng ngày
   * @param {string} userId - ID của người dùng
   * @param {Object} options - Các tùy chọn
   * @param {string} options.date - Ngày điểm danh
   * @param {string} options.timezone - Múi giờ của người dùng
   * @param {number} options.timezoneOffset - Chênh lệch múi giờ (phút)
   * @returns {Object} Kết quả điểm danh và thông tin thưởng
   */
  async checkIn(userId, { date, timezone, timezoneOffset }) {
    let userLocalTime;
    let now = new Date();

    // Khai báo biến
    let vietnamToday;
    let todayDate;
    let todayMonth;
    let todayYear;
    let clientDay;
    let clientMonth;
    let clientYear;

    // Phân tích ngày từ client
    const clientDate = date ? new Date(date) : null;

    // Nếu có ngày từ client, sử dụng nó trực tiếp
    if (clientDate) {
      // Lấy ngày, tháng, năm từ client date
      clientDay = clientDate.getDate();
      clientMonth = clientDate.getMonth();
      clientYear = clientDate.getFullYear();

      // Tạo đối tượng Date mới với ngày, tháng, năm từ client
      userLocalTime = new Date(clientYear, clientMonth, clientDay);
      userLocalTime.setHours(0, 0, 0, 0);

      // Phân tích ngày từ client để lấy ngày hiện tại
      const todayVietnam = new Date(clientYear, clientMonth, clientDay);
      todayVietnam.setHours(0, 0, 0, 0);

      // Khởi tạo giá trị cho biến
      todayDate = clientDay;
      todayMonth = clientMonth;
      todayYear = clientYear;

      // Lưu giá trị
      vietnamToday = todayVietnam;
      todayDate = todayVietnam.getDate();
      todayMonth = todayVietnam.getMonth();
      todayYear = todayVietnam.getFullYear();
    } else {
      // Fallback: Sử dụng múi giờ Việt Nam (GMT+7)
      const vietnamNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));

      userLocalTime = new Date(vietnamNow);
      userLocalTime.setHours(0, 0, 0, 0);

      // Sử dụng vietnamNow làm chuẩn cho ngày hiện tại
      vietnamToday = new Date(vietnamNow);
      vietnamToday.setHours(0, 0, 0, 0);

      // Lấy ngày, tháng, năm của ngày hiện tại theo múi giờ Việt Nam
      todayDate = vietnamToday.getDate();
      todayMonth = vietnamToday.getMonth();
      todayYear = vietnamToday.getFullYear();
    }

    const day = userLocalTime.getDate();
    const month = userLocalTime.getMonth();
    const year = userLocalTime.getFullYear();

    // Lấy thông tin người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Không tìm thấy người dùng');
    }

    // Kiểm tra xem đã điểm danh hôm nay chưa
    if (user.attendance_summary.last_attendance) {
      const lastDate = new Date(user.attendance_summary.last_attendance);
      lastDate.setHours(0, 0, 0, 0);

      // So sánh ngày, tháng, năm thay vì so sánh timestamp
      const lastDay = lastDate.getDate();
      const lastMonth = lastDate.getMonth();
      const lastYear = lastDate.getFullYear();

      // Kiểm tra xem đã điểm danh hôm nay chưa
      if (lastDay === day && lastMonth === month && lastYear === year) {
        throw new Error('Bạn đã điểm danh hôm nay rồi');
      }
    }

    // Tính toán số ngày liên tiếp
    let streakCount = 0;

    // Cập nhật thông tin điểm danh
    const attendanceResult = await user.updateAttendance(vietnamToday);
    if (!attendanceResult) {
      throw new Error('Bạn đã điểm danh hôm nay rồi');
    }

    streakCount = user.attendance_summary.current_streak;

    // Tính toán phần thưởng
    const baseReward = 10;
    let bonusReward = 0;

    // Tính toán phần thưởng
    if (streakCount === 7) {
      bonusReward = 100;
    } else if (streakCount === 15) {
      bonusReward = 250;
    } else if (streakCount === 30) {
      bonusReward = 1000;
    } else if (streakCount % 30 === 0 && streakCount > 30) {
      bonusReward = 1000;
    }

    // Tạo ghi chú
    let notes = 'Điểm danh hàng ngày';
    if (bonusReward > 0) {
      notes = `Điểm danh ${streakCount} ngày liên tiếp! Thưởng thêm ${bonusReward} xu.`;
    }

    // Tạo bản ghi điểm danh
    const attendance = await Attendance.createAttendance(
      userId,
      vietnamToday,
      streakCount
    );

    // Cộng xu cho người dùng
    const totalReward = baseReward + bonusReward;
    const coinResult = await user.addCoins(totalReward, 'Điểm danh hàng ngày');

    // Tạo giao dịch
    await Transaction.createTransaction({
      user_id: userId,
      description: notes,
      type: 'attendance',
      coin_change: totalReward,
      reference_type: 'attendance',
      reference_id: attendance._id,
      balance_after: user.coin
    });

    return {
      status: 'success',
      message: 'Điểm danh thành công',
      reward: {
        base: baseReward,
        bonus: bonusReward,
        total: totalReward
      },
      streak: streakCount,
      coin: user.coin,
      attendance: attendance
    };
  }

  /**
   * Cập nhật các ngày bỏ lỡ điểm danh
   */
  async updateMissedDays() {
    try {
      // Lấy tất cả người dùng
      const users = await User.find({ status: 'active' });

      // Lấy ngày hiện tại theo múi giờ Việt Nam
      const vietnamToday = new Date();
      vietnamToday.setHours(0, 0, 0, 0);

      // Lấy ngày hôm qua
      const yesterday = new Date(vietnamToday);
      yesterday.setDate(yesterday.getDate() - 1);

      console.log(`Cập nhật điểm danh bỏ lỡ cho ngày ${yesterday.toISOString().split('T')[0]}`);

      let updatedCount = 0;

      // Kiểm tra từng người dùng
      for (const user of users) {
        // Kiểm tra xem người dùng đã điểm danh hôm qua chưa
        const yesterdayAttendance = await Attendance.findOne({
          user_id: user._id,
          year: yesterday.getFullYear(),
          month: yesterday.getMonth(),
          day: yesterday.getDate()
        });

        // Nếu chưa điểm danh, tạo bản ghi missed
        if (!yesterdayAttendance) {
          await Attendance.createMissedAttendance(user._id, yesterday);

          // Reset streak nếu người dùng có streak > 0
          if (user.attendance_summary && user.attendance_summary.current_streak > 0) {
            user.attendance_summary.current_streak = 0;
            await user.save();
          }

          updatedCount++;
        }
      }

      console.log(`Đã cập nhật ${updatedCount} người dùng bỏ lỡ điểm danh`);

      return {
        status: 'success',
        message: `Đã cập nhật ${updatedCount} người dùng bỏ lỡ điểm danh`,
        updatedCount
      };
    } catch (error) {
      console.error('Lỗi khi cập nhật điểm danh bỏ lỡ:', error);
      throw error;
    }
  }

  /**
   * Lấy thời gian theo múi giờ của người dùng
   * @private
   */
  _getUserLocalTime(timezone, timezoneOffset) {
    let currentDate, currentMonth, currentYear;
    let userLocalTime;
    // Lấy thời gian hiện tại theo UTC
    const now = new Date();

    // Tạo thời gian Việt Nam (GMT+7)
    const vietnamNow = new Date();

    // Lấy ngày, tháng, năm, giờ, phút, giây theo múi giờ Việt Nam
    const vnYear = now.getUTCFullYear();
    const vnMonth = now.getUTCMonth();
    const vnDate = now.getUTCDate();
    const vnHours = now.getUTCHours() + 7; // Cộng 7 giờ cho múi giờ Việt Nam
    const vnMinutes = now.getUTCMinutes();
    const vnSeconds = now.getUTCSeconds();
    const vnMilliseconds = now.getUTCMilliseconds();

    // Xử lý trường hợp chuyển ngày khi cộng giờ
    let adjustedDate = vnDate;
    let adjustedMonth = vnMonth;
    let adjustedYear = vnYear;
    let adjustedHours = vnHours;

    if (vnHours >= 24) {
      adjustedHours = vnHours - 24;
      adjustedDate += 1;

      // Xử lý chuyển tháng nếu cần
      const daysInMonth = new Date(vnYear, vnMonth + 1, 0).getDate();
      if (adjustedDate > daysInMonth) {
        adjustedDate = 1;
        adjustedMonth += 1;

        // Xử lý chuyển năm nếu cần
        if (adjustedMonth > 11) {
          adjustedMonth = 0;
          adjustedYear += 1;
        }
      }
    }

    // Tạo đối tượng Date mới với thời gian Việt Nam đã điều chỉnh
    vietnamNow.setFullYear(adjustedYear, adjustedMonth, adjustedDate);
    vietnamNow.setHours(adjustedHours, vnMinutes, vnSeconds, vnMilliseconds);

    if (timezone && timezoneOffset !== undefined) {
      // Sử dụng múi giờ của người dùng
      // Đảm bảo timezoneOffset là số
      const offsetValue = typeof timezoneOffset === 'string' ? parseInt(timezoneOffset) : timezoneOffset;

      // Tạo thời gian người dùng dựa trên UTC
      const userDate = new Date();
      const utcYear = now.getUTCFullYear();
      const utcMonth = now.getUTCMonth();
      const utcDate = now.getUTCDate();
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const utcSeconds = now.getUTCSeconds();
      const utcMilliseconds = now.getUTCMilliseconds();

      // Tính toán giờ theo múi giờ người dùng (offsetValue là số phút)
      const userHours = utcHours - (offsetValue / 60);

      // Xử lý trường hợp chuyển ngày
      let userAdjustedDate = utcDate;
      let userAdjustedMonth = utcMonth;
      let userAdjustedYear = utcYear;
      let userAdjustedHours = userHours;

      if (userHours >= 24) {
        userAdjustedHours = userHours - 24;
        userAdjustedDate += 1;

        // Xử lý chuyển tháng nếu cần
        const daysInMonth = new Date(utcYear, utcMonth + 1, 0).getDate();
        if (userAdjustedDate > daysInMonth) {
          userAdjustedDate = 1;
          userAdjustedMonth += 1;

          // Xử lý chuyển năm nếu cần
          if (userAdjustedMonth > 11) {
            userAdjustedMonth = 0;
            userAdjustedYear += 1;
          }
        }
      } else if (userHours < 0) {
        userAdjustedHours = userHours + 24;
        userAdjustedDate -= 1;

        // Xử lý chuyển tháng nếu cần
        if (userAdjustedDate < 1) {
          userAdjustedMonth -= 1;

          // Xử lý chuyển năm nếu cần
          if (userAdjustedMonth < 0) {
            userAdjustedMonth = 11;
            userAdjustedYear -= 1;
          }

          // Lấy số ngày trong tháng trước
          const daysInPrevMonth = new Date(userAdjustedYear, userAdjustedMonth + 1, 0).getDate();
          userAdjustedDate = daysInPrevMonth;
        }
      }

      // Tạo đối tượng Date mới với thời gian người dùng đã điều chỉnh
      userDate.setFullYear(userAdjustedYear, userAdjustedMonth, userAdjustedDate);
      userDate.setHours(userAdjustedHours, utcMinutes, utcSeconds, utcMilliseconds);

      userLocalTime = userDate;
      currentDate = userAdjustedDate;
      currentMonth = userAdjustedMonth;
      currentYear = userAdjustedYear;
    } else {
      // Fallback: Sử dụng múi giờ Việt Nam (GMT+7) nếu không có thông tin múi giờ
      userLocalTime = vietnamNow;
      currentDate = adjustedDate;
      currentMonth = adjustedMonth;
      currentYear = adjustedYear;
    }

    // Đặt giờ về 00:00:00 cho userLocalTime để so sánh ngày chính xác
    userLocalTime.setHours(0, 0, 0, 0);

    return { userLocalTime, currentDate, currentMonth, currentYear };
  }

  /**
   * Lấy ngày hôm qua theo múi giờ người dùng
   * @private
   */
  _getYesterdayDate(timezone, timezoneOffset) {
    const yesterday = new Date();
    if (timezone && timezoneOffset !== undefined) {
      // Nếu có thông tin múi giờ, sử dụng múi giờ của người dùng
      const offsetValue = typeof timezoneOffset === 'string' ? parseInt(timezoneOffset) : timezoneOffset;
      const offsetInMs = offsetValue * 60 * 1000;
      const today = new Date();
      const userTime = new Date(today.getTime() - offsetInMs);
      yesterday.setTime(userTime.getTime());
    } else {
      // Fallback: Sử dụng múi giờ Việt Nam (GMT+7)
      const today = new Date();
      yesterday.setTime(today.getTime() + (7 * 60 * 60 * 1000));
    }

    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    return yesterday;
  }
}

module.exports = new AttendanceService();