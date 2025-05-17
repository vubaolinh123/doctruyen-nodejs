/**
 * Định nghĩa các instance methods cho User model
 * @param {Object} schema - Schema của User model
 */
const setupMethods = (schema) => {
  /**
   * Kiểm tra xem người dùng có quyền cụ thể không
   * @param {string} permissionName - Tên quyền cần kiểm tra
   * @returns {boolean} - true nếu có quyền, false nếu không
   */
  schema.methods.hasPermission = function(permissionName) {
    if (!this.permissions || !this.permissions.length) {
      return false;
    }

    const now = new Date();

    // Tìm quyền trong danh sách quyền của người dùng
    const permission = this.permissions.find(p =>
      p.name === permissionName &&
      p.active === true &&
      (!p.expires_at || p.expires_at > now)
    );

    return !!permission;
  };

  /**
   * Thêm quyền cho người dùng
   * @param {Object} permissionData - Thông tin quyền cần thêm
   * @returns {Promise<Object>} - Người dùng đã cập nhật
   */
  schema.methods.addPermission = async function(permissionData) {
    // Kiểm tra xem quyền đã tồn tại chưa
    const existingPermissionIndex = this.permissions.findIndex(p => p.name === permissionData.name);

    if (existingPermissionIndex >= 0) {
      // Nếu quyền đã tồn tại, cập nhật nó
      this.permissions[existingPermissionIndex] = {
        ...this.permissions[existingPermissionIndex].toObject(),
        ...permissionData,
        granted_at: new Date()
      };
    } else {
      // Nếu quyền chưa tồn tại, thêm mới
      this.permissions.push({
        ...permissionData,
        granted_at: new Date()
      });
    }

    return this.save();
  };

  /**
   * Xóa quyền của người dùng
   * @param {string} permissionName - Tên quyền cần xóa
   * @returns {Promise<Object>} - Người dùng đã cập nhật
   */
  schema.methods.removePermission = async function(permissionName) {
    // Lọc ra các quyền khác với quyền cần xóa
    this.permissions = this.permissions.filter(p => p.name !== permissionName);

    return this.save();
  };

  /**
   * Vô hiệu hóa quyền của người dùng
   * @param {string} permissionName - Tên quyền cần vô hiệu hóa
   * @returns {Promise<Object>} - Người dùng đã cập nhật
   */
  schema.methods.deactivatePermission = async function(permissionName) {
    // Tìm quyền cần vô hiệu hóa
    const permissionIndex = this.permissions.findIndex(p => p.name === permissionName);

    if (permissionIndex >= 0) {
      // Vô hiệu hóa quyền
      this.permissions[permissionIndex].active = false;
    }

    return this.save();
  };

  /**
   * Kích hoạt quyền của người dùng
   * @param {string} permissionName - Tên quyền cần kích hoạt
   * @returns {Promise<Object>} - Người dùng đã cập nhật
   */
  schema.methods.activatePermission = async function(permissionName) {
    // Tìm quyền cần kích hoạt
    const permissionIndex = this.permissions.findIndex(p => p.name === permissionName);

    if (permissionIndex >= 0) {
      // Kích hoạt quyền
      this.permissions[permissionIndex].active = true;
    }

    return this.save();
  };

  /**
   * Lấy danh sách quyền đang hoạt động của người dùng
   * @returns {Array} - Danh sách quyền đang hoạt động
   */
  schema.methods.getActivePermissions = function() {
    if (!this.permissions || !this.permissions.length) {
      return [];
    }

    const now = new Date();

    // Lọc ra các quyền đang hoạt động
    return this.permissions.filter(p =>
      p.active === true &&
      (!p.expires_at || p.expires_at > now)
    );
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