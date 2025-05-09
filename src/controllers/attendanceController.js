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
    let userLocalTime;
    // Lấy thời gian hiện tại theo UTC
    const now = new Date();

    // Tạo thời gian Việt Nam (GMT+7)
    // Sử dụng Date.UTC để tạo thời gian chính xác theo múi giờ
    const vietnamNow = new Date();

    // Lấy ngày, tháng, năm, giờ, phút, giây theo múi giờ Việt Nam
    // Lưu ý: getMonth() trả về 0-11, nên không cần điều chỉnh
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

      // Tính toán thời gian theo múi giờ của người dùng
      // timezoneOffset là số phút lệch so với UTC, và giá trị là âm cho múi giờ phía đông UTC
      // Ví dụ: Việt Nam (GMT+7) có timezoneOffset = -420

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

    // Đảm bảo rằng tháng và năm được yêu cầu không vượt quá tháng và năm hiện tại
    if (yearNum > currentYear || (yearNum === currentYear && monthNum > currentMonth)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot view attendance for future months'
      });
    }

    // Lấy ngày hiện tại theo múi giờ Việt Nam
    const todayVietnam = new Date(vietnamNow);
    todayVietnam.setHours(0, 0, 0, 0);
    const todayDate = todayVietnam.getDate();
    const todayMonth = todayVietnam.getMonth();
    const todayYear = todayVietnam.getFullYear();

    // Khởi tạo dữ liệu mặc định
    for (let i = 1; i <= daysInMonth; i++) {
      // Tạo đối tượng Date cho ngày i của tháng đang xem
      // Sử dụng cách so sánh trực tiếp ngày, tháng, năm thay vì đối tượng Date

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
        // Đảm bảo sử dụng đúng ngày từ bản ghi điểm danh
        // Đây là ngày thực tế đã điểm danh, không phải ngày từ client
        attendanceData[record.day] = 'attended';
      }
    });

    // Nếu là ngày hiện tại và chưa điểm danh
    // Tìm ngày trong tháng hiện tại mà trùng với ngày hiện tại
    for (let i = 1; i <= daysInMonth; i++) {
      // Sử dụng cách so sánh trực tiếp ngày, tháng, năm
      if (yearNum === todayYear &&
          monthNum === todayMonth &&
          i === todayDate) {

        // Kiểm tra xem ngày này đã được đánh dấu là 'attended' chưa
        if (attendanceData[i] === 'attended') {
        }
        // Nếu chưa điểm danh hôm nay, đánh dấu là 'pending'
        else if (!customer.attendance_summary.today_attended) {
          attendanceData[i] = 'pending';
        }
      }
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

    let userLocalTime;
    let now = new Date();

    // Khai báo biến toàn cục
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
      // Sử dụng ngày từ client làm ngày hiện tại
      const todayVietnam = new Date(clientYear, clientMonth, clientDay);
      todayVietnam.setHours(0, 0, 0, 0);

      // Hiển thị thời gian Việt Nam từ client
      const vietnamNow = new Date(clientDate);

      // Khởi tạo giá trị cho biến toàn cục
      todayDate = clientDay;
      todayMonth = clientMonth;
      todayYear = clientYear;

      // Sử dụng biến toàn cục để lưu giá trị
      vietnamToday = todayVietnam;
      todayDate = todayVietnam.getDate();
      todayMonth = todayVietnam.getMonth();
      todayYear = todayVietnam.getFullYear();
    } else {
      // Fallback: Sử dụng múi giờ Việt Nam (GMT+7)
      const vietnamNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));

      userLocalTime = new Date(vietnamNow);
      userLocalTime.setHours(0, 0, 0, 0);

      // Kiểm tra xem ngày điểm danh có phải là ngày hiện tại không
      // Sử dụng vietnamNow làm chuẩn cho ngày hiện tại
      vietnamToday = new Date(vietnamNow);
      vietnamToday.setHours(0, 0, 0, 0);

      // Lấy ngày, tháng, năm của ngày hiện tại theo múi giờ Việt Nam
      todayDate = vietnamToday.getDate();
      todayMonth = vietnamToday.getMonth();
      todayYear = vietnamToday.getFullYear();


      // Lấy ngày, tháng, năm của ngày điểm danh
      const checkInDate = userLocalTime.getDate();
      const checkInMonth = userLocalTime.getMonth();
      const checkInYear = userLocalTime.getFullYear();
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
    customer.attendance_summary.last_attendance = vietnamToday; // Sử dụng ngày hiện tại theo múi giờ Việt Nam
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

    // Sử dụng thời gian từ client thay vì tạo mới
    // Điều này đảm bảo thời gian điểm danh khớp với thời gian client gửi lên
    const attendanceVietnamTime = new Date(clientDate);

    // Tạo bản ghi giao dịch (transaction) cho việc điểm danh
    const transactionData = {
      customer_id: customerId,
      transaction_id: `ATTENDANCE_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      amount: 0, // Giao dịch điểm danh không liên quan đến tiền
      description: bonusReward > 0
        ? `Điểm danh ngày thứ ${consecutiveDays} (+${reward} xu cơ bản, +${bonusReward} xu thưởng)`
        : `Điểm danh ngày thứ ${consecutiveDays} (+${reward} xu)`,
      transaction_date: attendanceVietnamTime, // Sử dụng thời gian Việt Nam
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

    // Tạo bản ghi điểm danh mới với ngày hiện tại theo múi giờ Việt Nam
    // Sử dụng vietnamToday đã được tính toán ở trên, đây là ngày hiện tại theo múi giờ Việt Nam
    const attendance = new Attendance({
      customer_id: customerId,
      date: clientDate, // Sử dụng đối tượng Date từ client
      day: todayDate, // Sử dụng ngày hiện tại đã được tính toán
      month: todayMonth, // Sử dụng tháng hiện tại đã được tính toán
      year: todayYear, // Sử dụng năm hiện tại đã được tính toán
      status: 'attended',
      streak_count: consecutiveDays,
      reward,
      bonus_reward: bonusReward,
      timezone: timezone || 'Asia/Ho_Chi_Minh', // Lưu múi giờ của người dùng
      timezone_offset: 0, // Đặt timezone_offset = 0 vì chúng ta đã điều chỉnh thời gian thủ công
      attendance_time: date // Sử dụng chuỗi thời gian gốc từ client
    });

    await attendance.save();

    // Cập nhật reference_id của transaction và lưu transaction
    transactionData.reference_id = attendance._id.toString();
    const transaction = await Transaction.createTransaction(transactionData);

    // Lấy thời gian từ client
    // Phân tích thời gian từ chuỗi ISO
    const clientTimeComponents = clientDate.toISOString().match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);

    if (!clientTimeComponents) {
      console.error('Invalid client date format:', clientDate);
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Lấy các thành phần thời gian từ chuỗi ISO
    const [, isoYear, isoMonth, isoDay, isoHours, isoMinutes, isoSeconds] = clientTimeComponents;

    // Sử dụng thời gian từ client
    const vnHours = parseInt(isoHours);
    const vnMinutes = parseInt(isoMinutes);
    const vnSeconds = parseInt(isoSeconds);
    const vnDay = parseInt(isoDay);
    const vnMonth = parseInt(isoMonth); // Đã là 1-12 từ chuỗi ISO
    const vnYear = parseInt(isoYear);


    // Sử dụng chuỗi thời gian gốc từ client
    const originalClientDateString = date;

    // Định dạng thời gian hiển thị cho người dùng
    const vietnamTimeString = `${vnHours.toString().padStart(2, '0')}:${vnMinutes.toString().padStart(2, '0')}:${vnSeconds.toString().padStart(2, '0')} ${vnDay.toString().padStart(2, '0')}/${vnMonth.toString().padStart(2, '0')}/${vnYear}`;

    // Trả về thông tin điểm danh
    return res.json({
      success: true,
      message: 'Điểm danh thành công',
      data: {
        attendance: {
          id: attendance._id,
          date: originalClientDateString, // Sử dụng chuỗi thời gian gốc từ client
          reward,
          streak_count: consecutiveDays,
          bonus_reward: bonusReward,
          timezone: timezone || 'Asia/Ho_Chi_Minh',
          timezone_offset: 0, // Đặt timezone_offset = 0 vì chúng ta đã điều chỉnh thời gian thủ công
          attendance_time: originalClientDateString // Sử dụng chuỗi thời gian gốc từ client
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
          day: todayDate, // Sử dụng ngày hiện tại đã được tính toán
          month: todayMonth, // Sử dụng tháng hiện tại đã được tính toán
          year: todayYear, // Sử dụng năm hiện tại đã được tính toán
          date_string: originalClientDateString,
          vietnam_time: vietnamTimeString
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
