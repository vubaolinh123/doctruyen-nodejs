const Attendance = require('../../models/attendance');
const User = require('../../models/user');
const Transaction = require('../../models/transaction');
const Mission = require('../../models/mission');
const MissionProgress = require('../../models/missionProgress');
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
      } else if (record.status === 'purchased') {
        // Ngày đã mua bù cũng được coi là đã điểm danh
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

    // Tính toán số ngày điểm danh trong tháng hiện tại
    let monthlyDaysAttended = user.attendance_summary.monthly_days || 0;

    // Nếu đang xem tháng khác với tháng hiện tại, tính lại số ngày điểm danh cho tháng đó
    if (monthNum !== currentMonth || yearNum !== currentYear) {
      // Đếm số ngày điểm danh trong tháng được yêu cầu
      const monthlyAttendances = await Attendance.find({
        user_id: user._id,
        year: yearNum,
        month: monthNum,
        status: { $in: ['attended', 'purchased'] }
      });
      monthlyDaysAttended = monthlyAttendances.length;
    }

    return {
      attendanceData,
      stats: {
        totalDaysAttended: user.attendance_summary.total_days || 0,
        monthlyDaysAttended: monthlyDaysAttended
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
    // Check if transactions are supported by testing the MongoDB topology
    let session = null;
    let useTransaction = false;

    try {
      // Check if we're connected to a replica set or sharded cluster
      const admin = mongoose.connection.db.admin();
      const serverStatus = await admin.serverStatus();
      const isReplicaSet = serverStatus.repl && serverStatus.repl.setName;
      const isSharded = serverStatus.process === 'mongos';

      if (isReplicaSet || isSharded) {
        session = await mongoose.startSession();
        await session.startTransaction();
        useTransaction = true;
        console.log('[AttendanceService] Using transaction for atomic operations');
      } else {
        console.log('[AttendanceService] Standalone MongoDB detected, using non-transactional operations');
      }
    } catch (transactionError) {
      console.log('[AttendanceService] Transactions not supported, using non-transactional operations:', transactionError.message);
      if (session) {
        try {
          await session.endSession();
        } catch (endError) {
          // Ignore session end errors
        }
        session = null;
      }
    }

    try {
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
      const userQuery = User.findById(userId);
      if (session) userQuery.session(session);
      const user = await userQuery;
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

    // Cập nhật thông tin điểm danh với hệ thống milestone mới
    const attendanceOptions = session ? { session } : {};
    const attendanceResult = await user.updateAttendance(vietnamToday, attendanceOptions);
    if (!attendanceResult) {
      throw new Error('Bạn đã điểm danh hôm nay rồi');
    }

    // Tính toán phần thưởng cơ bản
    const baseReward = 1000;
    let bonusReward = 0;
    let notes = 'Điểm danh hàng ngày';

    // Kiểm tra milestone rewards (sẽ được implement sau)
    // TODO: Implement milestone checking logic here
    const milestoneRewards = await this.checkMilestoneRewards(userId, session);
    if (milestoneRewards.length > 0) {
      bonusReward = milestoneRewards.reduce((total, reward) => total + reward.reward_value, 0);
      notes = `Điểm danh hàng ngày! Đạt được ${milestoneRewards.length} mốc thưởng.`;
    }

      // Tạo bản ghi điểm danh với hệ thống milestone mới
      const attendanceCreateOptions = session ? { session } : {};
      const attendance = await this.createAttendanceRecord(
        userId,
        vietnamToday,
        baseReward + bonusReward,
        notes,
        attendanceCreateOptions
      );

      // Cộng xu cho người dùng
      const totalReward = baseReward + bonusReward;
      const coinOptions = session ? { session } : {};
      const coinResult = await user.addCoins(totalReward, 'Điểm danh hàng ngày', coinOptions);

      // Tạo giao dịch
      const transactionData = {
        user_id: userId,
        description: notes,
        type: 'attendance',
        coin_change: totalReward,
        reference_type: 'attendance',
        reference_id: attendance._id,
        balance_after: user.coin
      };

      if (session) {
        await Transaction.createTransaction(transactionData, { session });
      } else {
        await Transaction.createTransaction(transactionData);
      }

      // Update user attendance summary and calculate streak
      await user.updateAttendanceSummary();

      // Reload user to get updated attendance summary with current streak
      const updatedUser = await User.findById(userId);
      const streakCount = updatedUser.attendance_summary?.current_streak || 0;

      console.log('[AttendanceService] Updated attendance summary:', {
        userId,
        totalDays: updatedUser.attendance_summary?.total_days || 0,
        monthlyDays: updatedUser.attendance_summary?.monthly_days || 0,
        currentStreak: streakCount,
        lastAttendance: updatedUser.attendance_summary?.last_attendance
      });

      // Track attendance missions within the same transaction/session
      let missionResults = null;
      try {
        missionResults = await this.trackAttendanceMissions(userId, session);
        console.log('[AttendanceService] Mission tracking completed:', {
          userId,
          trackedMissions: missionResults.tracked,
          hasError: !!missionResults.error
        });
      } catch (missionError) {
        // Log mission tracking errors but don't fail the attendance process
        console.error('[AttendanceService] Error tracking attendance missions:', {
          userId,
          error: missionError.message
        });
        // For atomic transactions, we might want to rollback if mission tracking fails
        // But for now, we'll continue with attendance success
      }

      // Commit the transaction if using transactions
      if (useTransaction && session) {
        await session.commitTransaction();
        console.log('[AttendanceService] Transaction committed successfully');
      }

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
        attendance: attendance,
        missions: missionResults // Include mission tracking results
      };

    } catch (error) {
      // Rollback the transaction on any error if using transactions
      if (useTransaction && session) {
        try {
          await session.abortTransaction();
          console.log('[AttendanceService] Transaction aborted due to error');
        } catch (abortError) {
          console.error('[AttendanceService] Error aborting transaction:', abortError);
        }
      }
      console.error('[AttendanceService] Error in checkIn:', error);
      throw error;
    } finally {
      // End the session if it exists
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Cập nhật các ngày bỏ lỡ điểm danh với batch processing
   */
  async updateMissedDays() {
    try {
      const BATCH_SIZE = 500; // Xử lý 500 user một lần

      // Lấy ngày hiện tại theo múi giờ Việt Nam
      const vietnamToday = new Date();
      vietnamToday.setHours(0, 0, 0, 0);

      // Lấy ngày hôm qua
      const yesterday = new Date(vietnamToday);
      yesterday.setDate(yesterday.getDate() - 1);

      console.log(`[AttendanceCron] Bắt đầu cập nhật điểm danh bỏ lỡ cho ngày ${yesterday.toISOString().split('T')[0]}`);

      // Đếm tổng số user cần xử lý
      const totalUsers = await User.countDocuments({ status: 'active' });
      console.log(`[AttendanceCron] Tổng số user cần xử lý: ${totalUsers}`);

      let updatedCount = 0;
      let processedCount = 0;
      let skip = 0;

      // Xử lý theo batch
      while (processedCount < totalUsers) {
        console.log(`[AttendanceCron] Đang xử lý batch ${Math.floor(skip / BATCH_SIZE) + 1}, từ user ${skip + 1} đến ${Math.min(skip + BATCH_SIZE, totalUsers)}`);

        // Lấy batch user hiện tại
        const users = await User.find({ status: 'active' })
          .skip(skip)
          .limit(BATCH_SIZE)
          .select('_id attendance_summary');

        // Xử lý từng user trong batch
        for (const user of users) {
          try {
            // Kiểm tra xem người dùng đã điểm danh hôm qua chưa
            const yesterdayAttendance = await Attendance.findOne({
              user_id: user._id,
              year: yesterday.getFullYear(),
              month: yesterday.getMonth(),
              day: yesterday.getDate()
            });

            // Nếu chưa điểm danh, tạo bản ghi missed và reset streak
            if (!yesterdayAttendance) {
              // Tạo bản ghi missed (nếu có method này)
              if (Attendance.createMissedAttendance) {
                await Attendance.createMissedAttendance(user._id, yesterday);
              }

              // Reset streak nếu người dùng có streak > 0
              if (user.attendance_summary && user.attendance_summary.current_streak > 0) {
                user.attendance_summary.current_streak = 0;
                await user.save();
              }

              updatedCount++;
            }
          } catch (userError) {
            console.error(`[AttendanceCron] Lỗi khi xử lý user ${user._id}:`, userError);
          }
        }

        processedCount += users.length;
        skip += BATCH_SIZE;

        // Nghỉ 100ms giữa các batch để tránh quá tải database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[AttendanceCron] Hoàn thành! Đã xử lý ${processedCount} user, cập nhật ${updatedCount} user bỏ lỡ điểm danh`);

      return {
        status: 'success',
        message: `Đã cập nhật ${updatedCount} người dùng bỏ lỡ điểm danh`,
        updatedCount,
        totalProcessed: processedCount
      };
    } catch (error) {
      console.error('[AttendanceCron] Lỗi khi cập nhật điểm danh bỏ lỡ:', error);
      throw error;
    }
  }

  /**
   * Reset consecutive days về 0 vào đầu tháng mới (cho consecutive rewards)
   */
  async resetMonthlyConsecutiveDays() {
    try {
      const BATCH_SIZE = 500; // Xử lý 500 user một lần

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // Chỉ chạy vào ngày đầu tháng
      if (now.getDate() !== 1) {
        console.log('[AttendanceCron] Không phải ngày đầu tháng, bỏ qua reset consecutive days');
        return {
          status: 'skipped',
          message: 'Không phải ngày đầu tháng'
        };
      }

      console.log(`[AttendanceCron] Bắt đầu reset consecutive days cho tháng ${currentMonth + 1}/${currentYear}`);

      // Đếm tổng số user cần xử lý
      const totalUsers = await User.countDocuments({
        status: 'active',
        'attendance_summary.current_streak': { $gt: 0 }
      });
      console.log(`[AttendanceCron] Tổng số user cần reset: ${totalUsers}`);

      let resetCount = 0;
      let processedCount = 0;
      let skip = 0;

      // Xử lý theo batch
      while (processedCount < totalUsers) {
        console.log(`[AttendanceCron] Đang reset batch ${Math.floor(skip / BATCH_SIZE) + 1}, từ user ${skip + 1} đến ${Math.min(skip + BATCH_SIZE, totalUsers)}`);

        // Lấy batch user hiện tại
        const users = await User.find({
          status: 'active',
          'attendance_summary.current_streak': { $gt: 0 }
        })
          .skip(skip)
          .limit(BATCH_SIZE)
          .select('_id attendance_summary');

        // Reset consecutive days cho từng user trong batch
        for (const user of users) {
          try {
            // Kiểm tra xem user có điểm danh hôm nay chưa
            const todayAttendance = await Attendance.findOne({
              user_id: user._id,
              year: currentYear,
              month: currentMonth,
              day: 1 // Ngày đầu tháng
            });

            // Nếu chưa điểm danh hôm nay thì reset consecutive days
            if (!todayAttendance) {
              user.attendance_summary.current_streak = 0;
              await user.save();
              resetCount++;
            }
          } catch (userError) {
            console.error(`[AttendanceCron] Lỗi khi reset user ${user._id}:`, userError);
          }
        }

        processedCount += users.length;
        skip += BATCH_SIZE;

        // Nghỉ 100ms giữa các batch để tránh quá tải database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[AttendanceCron] Hoàn thành reset! Đã xử lý ${processedCount} user, reset ${resetCount} user`);

      return {
        status: 'success',
        message: `Đã reset consecutive days cho ${resetCount} người dùng`,
        resetCount,
        totalProcessed: processedCount
      };
    } catch (error) {
      console.error('[AttendanceCron] Lỗi khi reset consecutive days:', error);
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

  /**
   * Track attendance missions for user
   * @param {string} userId - ID của người dùng
   * @param {Object} session - MongoDB session for transaction
   * @returns {Promise<Object>} - Kết quả tracking missions
   */
  async trackAttendanceMissions(userId, session = null) {
    try {
      console.log('[Attendance Mission Tracking] Starting attendance mission tracking for user:', userId);

      // Get all active attendance missions
      const missionQuery = Mission.find({
        status: true,
        $or: [
          { 'requirement.type': 'attendance' },
          { 'subMissions.requirement.type': 'attendance' }
        ]
      }).lean();

      if (session) {
        missionQuery.session(session);
      }

      const attendanceMissions = await missionQuery;

      if (!attendanceMissions.length) {
        console.log('[Attendance Mission Tracking] No active attendance missions found');
        return { tracked: 0, results: [] };
      }

      console.log('[Attendance Mission Tracking] Found attendance missions:', {
        count: attendanceMissions.length,
        missions: attendanceMissions.map(m => ({ id: m._id, title: m.title, type: m.type }))
      });

      const missionResults = [];

      // Process each mission
      for (const mission of attendanceMissions) {
        try {
          console.log('[Attendance Mission Tracking] Processing mission:', {
            missionId: mission._id,
            missionTitle: mission.title,
            missionType: mission.type,
            requirementType: mission.requirement.type
          });

          // Check if this mission should be tracked for this user
          const shouldTrack = await this.shouldTrackAttendanceMission(userId, mission, session);
          if (!shouldTrack) {
            console.log('[Attendance Mission Tracking] Mission should not be tracked for this user:', {
              missionId: mission._id,
              reason: 'Mission conditions not met'
            });
            continue;
          }

          // Track main mission progress if it's attendance type
          let progressResult = null;
          if (mission.requirement.type === 'attendance') {
            progressResult = await MissionProgress.updateProgress(
              userId,
              mission._id,
              1, // Increment by 1 for each attendance
              true // Increment mode
            );
          } else {
            // If main mission is not attendance type, get existing progress without updating
            const date = new Date();
            progressResult = await MissionProgress.findOne({
              user_id: userId,
              mission_id: mission._id,
              year: date.getFullYear(),
              month: date.getMonth(),
              day: date.getDate()
            }) || {
              current_progress: 0,
              completed: false
            };
          }

          // Track sub-missions if any
          const subMissionResults = [];
          if (mission.subMissions && mission.subMissions.length > 0) {
            for (let subIndex = 0; subIndex < mission.subMissions.length; subIndex++) {
              const subMission = mission.subMissions[subIndex];

              // Check if this sub-mission should count for attendance
              if (subMission.requirement.type === 'attendance') {
                try {
                  const subProgressResult = await MissionProgress.updateSubMissionProgress(
                    userId,
                    mission._id,
                    subIndex,
                    1, // Increment by 1 for each attendance
                    true // Increment mode
                  );

                  subMissionResults.push({
                    sub_mission_index: subIndex,
                    sub_mission_title: subMission.title,
                    sub_mission_type: subMission.requirement.type,
                    sub_mission_progress: subProgressResult.sub_progress.find(sp => sp.sub_mission_index === subIndex)
                  });

                  console.log('[Attendance Mission Tracking] Sub-mission progress updated:', {
                    missionId: mission._id,
                    subMissionIndex: subIndex,
                    subMissionTitle: subMission.title,
                    subMissionType: subMission.requirement.type
                  });
                } catch (subError) {
                  console.error('[Attendance Mission Tracking] Error updating sub-mission progress:', {
                    missionId: mission._id,
                    subMissionIndex: subIndex,
                    error: subError.message
                  });
                }
              }
            }
          }

          missionResults.push({
            mission_id: mission._id,
            mission_title: mission.title,
            mission_type: mission.type,
            main_progress: progressResult,
            sub_missions: subMissionResults
          });

          console.log('[Attendance Mission Tracking] Mission tracking completed:', {
            missionId: mission._id,
            missionTitle: mission.title,
            mainProgress: progressResult?.current_progress || 0,
            subMissionsCount: subMissionResults.length
          });

        } catch (missionError) {
          console.error('[Attendance Mission Tracking] Error processing mission:', {
            missionId: mission._id,
            error: missionError.message
          });
          // Continue with other missions even if one fails
        }
      }

      console.log('[Attendance Mission Tracking] Attendance mission tracking completed:', {
        userId,
        totalMissions: attendanceMissions.length,
        trackedMissions: missionResults.length
      });

      return {
        tracked: missionResults.length,
        results: missionResults
      };

    } catch (error) {
      console.error('[Attendance Mission Tracking] Error in trackAttendanceMissions:', error);
      // Don't throw error to prevent attendance from failing
      return { tracked: 0, results: [], error: error.message };
    }
  }

  /**
   * Check if attendance mission should be tracked for user
   * @param {string} userId - ID của người dùng
   * @param {Object} mission - Mission object
   * @param {Object} session - MongoDB session for transaction
   * @returns {Promise<boolean>} - Should track or not
   */
  async shouldTrackAttendanceMission(userId, mission, session = null) {
    try {
      // Get current time info
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      const firstDayOfYear = new Date(currentYear, 0, 1);
      const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
      const currentWeek = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

      // Build time query based on mission type
      let timeQuery = {};
      if (mission.type === 'daily') {
        timeQuery = { day: currentDay, month: currentMonth, year: currentYear };
      } else if (mission.type === 'weekly') {
        timeQuery = { week: currentWeek, year: currentYear };
      }

      // Check if there's already a progress record for this mission and time period
      const progressQuery = MissionProgress.findOne({
        user_id: userId,
        mission_id: mission._id,
        ...timeQuery
      });

      if (session) {
        progressQuery.session(session);
      }

      const existingProgress = await progressQuery;

      // For attendance missions, we typically allow only one attendance per day
      // So we check if the mission is already completed for this time period
      if (existingProgress && existingProgress.completed) {
        console.log('[Attendance Mission Tracking] Mission already completed for this period:', {
          missionId: mission._id,
          missionTitle: mission.title,
          missionType: mission.type,
          timeQuery
        });
        return false;
      }

      console.log('[Attendance Mission Tracking] Mission conditions check passed:', {
        missionId: mission._id,
        missionTitle: mission.title,
        missionType: mission.type,
        hasExistingProgress: !!existingProgress,
        currentProgress: existingProgress?.current_progress || 0
      });

      return true;

    } catch (error) {
      console.error('[Attendance Mission Tracking] Error in shouldTrackAttendanceMission:', error);
      return false;
    }
  }

  /**
   * Tạo bản ghi điểm danh mới (milestone-based system)
   * @param {string} userId - ID của người dùng
   * @param {Date} date - Ngày điểm danh
   * @param {number} reward - Tổng phần thưởng
   * @param {string} notes - Ghi chú
   * @param {Object} options - Tùy chọn (session, etc.)
   * @returns {Promise<Object>} - Bản ghi điểm danh mới
   */
  async createAttendanceRecord(userId, date, reward, notes, options = {}) {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    const attendanceData = {
      user_id: userId,
      date,
      status: 'attended',
      reward,
      day,
      month,
      year,
      notes,
      attendance_time: new Date()
    };

    if (options.session) {
      return await Attendance.create([attendanceData], { session: options.session });
    } else {
      return await Attendance.create(attendanceData);
    }
  }

  /**
   * Kiểm tra và trả về các milestone rewards đã đạt được
   * @param {string} userId - ID của người dùng
   * @param {Object} session - MongoDB session (optional)
   * @returns {Promise<Array>} - Danh sách milestone rewards
   */
  async checkMilestoneRewards(userId, session = null) {
    // TODO: Implement milestone checking logic
    // This will be implemented when we create the milestone management system
    return [];
  }
}

module.exports = new AttendanceService();