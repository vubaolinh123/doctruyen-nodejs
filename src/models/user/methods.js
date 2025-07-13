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
   * Cập nhật thông tin điểm danh mới (milestone-based system)
   * @param {Date} date - Ngày điểm danh
   * @returns {boolean} - Kết quả điểm danh (thành công/thất bại)
   */
  schema.methods.updateAttendance = async function(date) {
    const lastDate = this.attendance_summary.last_attendance;

    // Nếu đã điểm danh hôm nay
    if (lastDate && lastDate.toDateString() === date.toDateString()) {
      return false;
    }

    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();

    // Kiểm tra xem có phải tháng mới không
    if (this.attendance_summary.current_month !== currentMonth ||
        this.attendance_summary.current_year !== currentYear) {
      // Reset monthly attendance cho tháng mới
      this.attendance_summary.monthly_days = 0;
      this.attendance_summary.current_month = currentMonth;
      this.attendance_summary.current_year = currentYear;
    }

    // Cập nhật thông tin điểm danh
    this.attendance_summary.last_attendance = date;
    this.attendance_summary.total_days += 1;
    this.attendance_summary.monthly_days += 1;

    await this.save();
    return true;
  };

  /**
   * ✅ Recalculate attendance summary for milestone-based system
   * This method calculates total lifetime days and current month days
   */
  schema.methods.updateAttendanceSummary = async function() {
    try {
      const Attendance = require('../attendance');

      // Get all attendance records for user, sorted by date
      const attendances = await Attendance.find({
        user_id: this._id,
        status: { $in: ['attended', 'purchased'] }
      }).sort({ year: 1, month: 1, day: 1 });

      console.log(`[User.updateAttendanceSummary] Found ${attendances.length} valid attendance records for user ${this._id}`);

      if (attendances.length === 0) {
        // Reset stats to 0 if no attendance
        this.attendance_summary.total_days = 0;
        this.attendance_summary.monthly_days = 0;
        this.attendance_summary.current_month = new Date().getMonth();
        this.attendance_summary.current_year = new Date().getFullYear();
        this.attendance_summary.last_attendance = null;
        await this.save();
        return;
      }

      // Calculate milestone-based stats
      const totalDays = attendances.length;
      let lastAttendanceDate = null;

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // Calculate monthly attendance for current month
      const currentMonthAttendances = attendances.filter(att =>
        att.month === currentMonth && att.year === currentYear
      );

      console.log(`[User.updateAttendanceSummary] Total: ${totalDays}, Current month (${currentMonth}/${currentYear}): ${currentMonthAttendances.length}`);

      // Find the most recent attendance date
      if (attendances.length > 0) {
        const lastAttendance = attendances[attendances.length - 1];
        lastAttendanceDate = new Date(lastAttendance.year, lastAttendance.month, lastAttendance.day);
      }

      // Update user stats with milestone-based system
      this.attendance_summary.total_days = totalDays;
      this.attendance_summary.monthly_days = currentMonthAttendances.length;
      this.attendance_summary.current_month = currentMonth;
      this.attendance_summary.current_year = currentYear;
      this.attendance_summary.last_attendance = lastAttendanceDate;

      await this.save();

      console.log(`[User.updateAttendanceSummary] ✅ Updated for user ${this._id}:`);
      console.log(`  - Total days: ${totalDays}`);
      console.log(`  - Monthly days: ${currentMonthAttendances.length}`);
      console.log(`  - Current month/year: ${currentMonth}/${currentYear}`);
      console.log(`  - Last attendance: ${lastAttendanceDate?.toISOString().split('T')[0]}`);

    } catch (error) {
      console.error('❌ Error updating attendance summary:', error);
      throw error;
    }
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

    // Check if we should create transaction automatically
    // Create transaction for attendance rewards, milestone rewards, and admin actions
    const shouldCreateTransaction = typeof options === 'object' && options.createTransaction !== false;
    const isRewardTransaction = typeof options === 'object' && (options.type === 'attendance' || options.type === 'reward' || options.type === 'admin');

    if (shouldCreateTransaction && isRewardTransaction) {
      // ✅ Create transaction record for attendance rewards only
      try {
        const Transaction = require('../transaction');

        // Parse options để lấy description và metadata
        let description = 'Cộng xu';
        let metadata = {};

        if (typeof options === 'string') {
          description = options || 'Cộng xu';
        } else if (typeof options === 'object') {
          description = options.description || options.reason || 'Cộng xu';
          metadata = options.metadata || {};
        }

        // Determine transaction type and reference type based on options (declare early)
        const transactionType = options.type || 'attendance';

        // Determine reference type based on transaction type
        let referenceType = 'attendance'; // default
        if (transactionType === 'reward') {
          referenceType = 'milestone';
        } else if (transactionType === 'admin') {
          // For admin actions, check metadata for more specific reference type
          referenceType = metadata.admin_action === 'force_claim_milestone' ? 'milestone' : 'other';
        }

        // Determine transaction type label
        let transactionTypeLabel = 'attendance_reward'; // default
        if (transactionType === 'reward') {
          transactionTypeLabel = 'milestone_reward';
        } else if (transactionType === 'admin') {
          transactionTypeLabel = 'admin_action';
        }

        // ✅ Generate unique transaction ID với timestamp và random
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);

        // Use appropriate prefix based on transaction type
        let transactionPrefix = 'REWARD';
        if (transactionType === 'admin') {
          transactionPrefix = 'ADMIN';
        } else if (transactionType === 'attendance') {
          transactionPrefix = 'ATTEND';
        }

        const transactionId = `${transactionPrefix}_${this._id}_${timestamp}_${random}`;

        console.log(`[User.addCoins] Creating ${transactionType} transaction: ${transactionId}`);
        console.log(`[User.addCoins] Description: ${description}`);
        console.log(`[User.addCoins] Amount: +${amount} xu`);

        const transactionData = {
          user_id: this._id,
          transaction_id: transactionId,
          description: description,
          coin_change: amount, // Positive for reward
          type: transactionType, // Use the type from options ('attendance' or 'reward')
          direction: 'in',
          status: 'completed',
          reference_type: referenceType, // 'milestone' for rewards, 'attendance' for attendance
          balance_after: this.coin, // ✅ Add balance_after field
          metadata: {
            ...metadata,
            transaction_type: transactionTypeLabel,
            user_coin_before: this.coin - amount,
            user_coin_after: this.coin
          }
        };

        console.log(`[User.addCoins] Transaction data:`, JSON.stringify(transactionData, null, 2));

        const transaction = await Transaction.create(transactionData);

        console.log(`[User.addCoins] ✅ Created ${transactionType} transaction record: ${transaction._id} (+${amount} xu for user ${this._id})`);

      } catch (transactionError) {
        console.error(`[User.addCoins] ❌ Error creating transaction record:`, transactionError);
        console.error(`[User.addCoins] ❌ Error details:`, transactionError.message);
        console.error(`[User.addCoins] ❌ Error stack:`, transactionError.stack);
        // Don't throw error to avoid breaking the main flow
      }
    } else {
      console.log(`[User.addCoins] ✅ Added ${amount} xu to user ${this._id} without creating transaction (will be handled externally)`);
    }

    return this.coin;
  };

  /**
   * Trừ xu của người dùng
   * @param {number} amount - Số lượng xu
   * @param {string|Object} options - Lý do trừ xu hoặc các tùy chọn
   * @returns {Object} - Thông tin xu sau khi trừ
   */
  schema.methods.deductCoins = async function(amount, options = '') {
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

    // Parse reason from options
    let reason = '';
    if (typeof options === 'string') {
      reason = options;
    } else if (typeof options === 'object') {
      reason = options.reason || options.description || '';
    }

    console.log(`[User.deductCoins] ✅ Deducted ${amount} xu from user ${this._id} (reason: ${reason})`);

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
      // Thêm xu (không tạo transaction tự động)
      const amountToAdd = newAmount - currentCoins;
      await this.addCoins(amountToAdd, { ...options, createTransaction: false });
      return {
        coin: this.coin,
        coin_total: this.coin_total,
        coin_spent: this.coin_spent,
        changed: amountToAdd
      };
    } else if (newAmount < currentCoins) {
      // Trừ xu (không tạo transaction tự động)
      const amountToDeduct = currentCoins - newAmount;
      await this.deductCoins(amountToDeduct, { ...options, createTransaction: false });
      return {
        coin: this.coin,
        coin_total: this.coin_total,
        coin_spent: this.coin_spent,
        changed: -amountToDeduct
      };
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