/**
 * Định nghĩa các static methods cho Attendance model
 * @param {Object} schema - Schema của Attendance model
 */
const setupStatics = (schema) => {
  /**
   * Tính toán phần thưởng dựa trên số ngày liên tiếp
   * @param {Number} streakCount - Số ngày điểm danh liên tiếp
   * @returns {Number} - Phần thưởng
   */
  schema.statics.calculateReward = function(streakCount) {
    let reward = 10; // Phần thưởng cơ bản

    // Thưởng thêm cho các mốc đặc biệt
    if (streakCount === 7) {
      reward += 100;
    } else if (streakCount === 15) {
      reward += 250;
    } else if (streakCount === 30) {
      reward += 1000;
    } else if (streakCount % 30 === 0 && streakCount > 30) {
      reward += 1000; // Thưởng thêm cho mỗi 30 ngày
    }

    return reward;
  };

  /**
   * Tạo bản ghi điểm danh mới
   * @param {String} userId - ID của người dùng
   * @param {Date} date - Ngày điểm danh
   * @param {Number} streakCount - Số ngày điểm danh liên tiếp
   * @returns {Promise<Object>} - Bản ghi điểm danh mới
   */
  schema.statics.createAttendance = async function(userId, date, streakCount) {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    // Tính toán phần thưởng
    const baseReward = 10;
    let bonusReward = 0;

    // Thưởng thêm cho các mốc đặc biệt
    if (streakCount === 7) {
      bonusReward = 100;
    } else if (streakCount === 15) {
      bonusReward = 250;
    } else if (streakCount === 30) {
      bonusReward = 1000;
    } else if (streakCount % 30 === 0 && streakCount > 30) {
      bonusReward = 1000; // Thưởng thêm cho mỗi 30 ngày
    }

    // Tạo ghi chú
    let notes = '';
    if (bonusReward > 0) {
      notes = `Điểm danh ${streakCount} ngày liên tiếp! Thưởng thêm ${bonusReward} xu.`;
    }

    // Tạo bản ghi mới với thời gian hiện tại theo múi giờ Việt Nam
    const now = new Date(); // Sử dụng múi giờ đã thiết lập (Asia/Ho_Chi_Minh)

    return this.create({
      user_id: userId,
      date,
      status: 'attended',
      reward: baseReward + bonusReward,
      day,
      month,
      year,
      streak_count: streakCount,
      bonus_reward: bonusReward,
      notes,
      attendance_time: now
    });
  };

  /**
   * Tạo bản ghi điểm danh bỏ lỡ
   * @param {String} userId - ID của người dùng
   * @param {Date} date - Ngày bỏ lỡ điểm danh
   * @returns {Promise<Object>} - Bản ghi điểm danh bỏ lỡ
   */
  schema.statics.createMissedAttendance = async function(userId, date) {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    // Tạo bản ghi missed với thời gian hiện tại theo múi giờ Việt Nam
    const now = new Date(); // Sử dụng múi giờ đã thiết lập (Asia/Ho_Chi_Minh)

    return this.create({
      user_id: userId,
      date,
      status: 'missed',
      reward: 0,
      day,
      month,
      year,
      streak_count: 0,
      bonus_reward: 0,
      notes: 'Bỏ lỡ điểm danh',
      attendance_time: now
    });
  };

  /**
   * Tạo bản ghi missed
   * @param {String} userId - ID của người dùng
   * @param {Date} date - Ngày bỏ lỡ
   * @returns {Promise<Object>} - Bản ghi missed
   */
  schema.statics.createMissedAttendance = async function(userId, date) {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    // Sử dụng múi giờ Việt Nam
    const now = new Date();

    return this.create({
      user_id: userId,
      date,
      status: 'missed',
      reward: 0,
      day,
      month,
      year,
      streak_count: 0,
      bonus_reward: 0,
      notes: 'Bỏ lỡ điểm danh',
      attendance_time: now
    });
  };

  /**
   * Lấy lịch sử điểm danh của người dùng theo tháng
   * @param {String} userId - ID của người dùng
   * @param {Number} month - Tháng (0-11)
   * @param {Number} year - Năm
   * @returns {Promise<Array>} - Danh sách điểm danh
   */
  schema.statics.getMonthlyAttendance = async function(userId, month, year) {
    return this.find({
      user_id: userId,
      month,
      year
    }).sort({ day: 1 });
  };

  /**
   * Kiểm tra người dùng đã điểm danh hôm nay chưa
   * @param {String} userId - ID của người dùng
   * @returns {Promise<Boolean>} - Đã điểm danh hay chưa
   */
  schema.statics.hasAttendedToday = async function(userId) {
    // Lấy ngày hiện tại theo múi giờ Việt Nam
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const attendance = await this.findOne({
      user_id: userId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    return !!attendance;
  };
};

module.exports = setupStatics;
