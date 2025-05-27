/**
 * Định nghĩa các instance methods cho User model
 * @param {Object} schema - Schema của User model
 */
const setupMethods = (schema) => {
  /**
   * Kiểm tra xem người dùng có quyền cụ thể không
   * @param {string} permissionName - Tên quyền cần kiểm tra
   * @returns {Promise<boolean>} - true nếu có quyền, false nếu không
   */
  schema.methods.hasPermission = async function(permissionName) {
    const UserPermission = require('../userPermission');
    return await UserPermission.hasPermission(this._id, permissionName);
  };

  /**
   * Thêm quyền cho người dùng
   * @param {Object} permissionData - Thông tin quyền cần thêm
   * @returns {Promise<Object>} - UserPermission đã tạo/cập nhật
   */
  schema.methods.addPermission = async function(permissionData) {
    const UserPermission = require('../userPermission');
    return await UserPermission.addOrUpdatePermission(this._id, permissionData);
  };

  /**
   * Xóa quyền của người dùng
   * @param {string} permissionName - Tên quyền cần xóa
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.methods.removePermission = async function(permissionName) {
    const UserPermission = require('../userPermission');
    return await UserPermission.removePermission(this._id, permissionName);
  };

  /**
   * Vô hiệu hóa quyền của người dùng
   * @param {string} permissionName - Tên quyền cần vô hiệu hóa
   * @returns {Promise<Object>} - UserPermission đã cập nhật
   */
  schema.methods.deactivatePermission = async function(permissionName) {
    const UserPermission = require('../userPermission');
    const permission = await UserPermission.findUserPermission(this._id, permissionName);
    if (permission) {
      return await permission.deactivate();
    }
    return null;
  };

  /**
   * Kích hoạt quyền của người dùng
   * @param {string} permissionName - Tên quyền cần kích hoạt
   * @returns {Promise<Object>} - UserPermission đã cập nhật
   */
  schema.methods.activatePermission = async function(permissionName) {
    const UserPermission = require('../userPermission');
    const permission = await UserPermission.findUserPermission(this._id, permissionName);
    if (permission) {
      return await permission.activate();
    }
    return null;
  };

  /**
   * Lấy danh sách quyền đang hoạt động của người dùng
   * @returns {Promise<Array>} - Danh sách quyền đang hoạt động
   */
  schema.methods.getActivePermissions = async function() {
    const UserPermission = require('../userPermission');
    return await UserPermission.getActivePermissions(this._id);
  };
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
    yesterday.setHours(0, 0, 0, 0);

    // Chuẩn hóa lastDate để so sánh
    let isConsecutive = false;
    if (lastDate) {
      const normalizedLastDate = new Date(lastDate);
      normalizedLastDate.setHours(0, 0, 0, 0);
      isConsecutive = normalizedLastDate.getTime() === yesterday.getTime();
    }

    // Cập nhật thông tin điểm danh
    this.attendance_summary.last_attendance = date;
    this.attendance_summary.total_days += 1;

    if (isConsecutive) {
      // Nếu ngày liên tiếp, tăng số ngày liên tiếp lên 1
      this.attendance_summary.current_streak += 1;
    } else {
      // Nếu không liên tiếp hoặc lần đầu điểm danh, set về 1
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
   * @param {string|Object} options - Lý do cộng xu hoặc các tùy chọn
   * @returns {number} - Số xu hiện tại
   */
  schema.methods.addCoins = async function(amount, options = '') {
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Số lượng xu phải là số dương');
    }

    // Cộng xu
    this.coin += amount;
    this.coin_total += amount;

    await this.save();

    return this.coin;
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

  /**
   * Trừ xu của người dùng (alias của deductCoins)
   * @param {number} amount - Số lượng xu
   * @param {Object} options - Các tùy chọn
   * @returns {Object} - Thông tin xu sau khi trừ
   */
  schema.methods.subtractCoins = async function(amount, options = {}) {
    return this.deductCoins(amount, options);
  };

  /**
   * Cập nhật số xu của người dùng
   * @param {number} newAmount - Số lượng xu mới
   * @param {Object} options - Các tùy chọn
   * @returns {Object} - Thông tin xu sau khi cập nhật
   */
  schema.methods.updateCoins = async function(newAmount, options = {}) {
    if (isNaN(newAmount) || newAmount < 0) {
      throw new Error('Số lượng xu phải là số không âm');
    }

    const currentCoins = this.coin;

    if (newAmount > currentCoins) {
      // Thêm xu
      const amountToAdd = newAmount - currentCoins;
      return this.addCoins(amountToAdd, options);
    } else if (newAmount < currentCoins) {
      // Trừ xu
      const amountToDeduct = currentCoins - newAmount;
      return this.deductCoins(amountToDeduct, options);
    } else {
      // Không thay đổi
      return {
        coin: this.coin,
        coin_total: this.coin_total,
        coin_spent: this.coin_spent,
        changed: 0
      };
    }
  };
};

module.exports = setupMethods;