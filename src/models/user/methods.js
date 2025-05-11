/**
 * Định nghĩa các instance methods cho User model
 * @param {Object} schema - Schema của User model
 */
const setupMethods = (schema) => {
  /**
   * Kiểm tra xem người dùng có phải là admin hay không
   * @returns {boolean}
   */
  schema.methods.isAdmin = function() {
    return this.role === 'admin';
  };

  /**
   * Kiểm tra xem người dùng có phải là tác giả hay không
   * @returns {boolean}
   */
  schema.methods.isAuthor = function() {
    return this.role === 'author';
  };

  /**
   * Cập nhật thông tin điểm danh
   * @param {Date} date - Ngày điểm danh
   * @returns {boolean} - Kết quả điểm danh (thành công/thất bại)
   */
  schema.methods.updateAttendance = async function(date) {
    const lastDate = this.attendance_summary.last_attendance;

    // Nếu đã điểm danh hôm nay
    if (lastDate && lastDate.toDateString() === date.toDateString()) {
      return false;
    }

    // Kiểm tra xem ngày cuối cùng điểm danh có phải là ngày hôm qua không
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const isConsecutive = lastDate && lastDate.toDateString() === yesterday.toDateString();

    // Cập nhật thông tin điểm danh
    this.attendance_summary.last_attendance = date;
    this.attendance_summary.total_days += 1;

    if (isConsecutive) {
      // Nếu ngày liên tiếp, tăng số ngày liên tiếp lên 1
      this.attendance_summary.current_streak += 1;
    } else {
      // Nếu không liên tiếp, reset về 1
      this.attendance_summary.current_streak = 1;
    }

    // Cập nhật số ngày liên tiếp dài nhất
    if (this.attendance_summary.current_streak > this.attendance_summary.longest_streak) {
      this.attendance_summary.longest_streak = this.attendance_summary.current_streak;
    }

    await this.save();
    return true;
  };

  /**
   * Cộng xu cho người dùng
   * @param {number} amount - Số lượng xu
   * @param {string} reason - Lý do cộng xu
   * @returns {Object} - Thông tin xu sau khi cộng
   */
  schema.methods.addCoins = async function(amount, reason = '') {
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Số lượng xu phải là số dương');
    }

    // Cộng xu
    this.coin += amount;
    this.coin_total += amount;

    await this.save();

    return {
      coin: this.coin,
      coin_total: this.coin_total,
      added: amount,
      reason: reason
    };
  };

  /**
   * Trừ xu của người dùng
   * @param {number} amount - Số lượng xu
   * @param {string} reason - Lý do trừ xu
   * @returns {Object} - Thông tin xu sau khi trừ
   */
  schema.methods.deductCoins = async function(amount, reason = '') {
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Số lượng xu phải là số dương');
    }

    if (this.coin < amount) {
      throw new Error('Số xu không đủ');
    }

    // Trừ xu
    this.coin -= amount;
    this.coin_spent += amount;

    await this.save();

    return {
      coin: this.coin,
      coin_spent: this.coin_spent,
      deducted: amount,
      reason: reason
    };
  };
};

module.exports = setupMethods; 