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
   * ✅ Recalculate attendance summary from all attendance records
   * This method properly handles purchased attendance for consecutive streaks
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
        this.attendance_summary.current_streak = 0;
        this.attendance_summary.longest_streak = 0;
        this.attendance_summary.last_attendance = null;
        await this.save();
        return;
      }

      // Calculate stats
      const totalDays = attendances.length;
      let longestStreak = 0;
      let tempStreak = 0;
      let currentStreak = 0;
      let lastDate = null;
      let lastAttendanceDate = null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // ✅ CORRECT LOGIC: Purchased = cumulative, Regular = consecutive + cumulative với purchased
      const purchasedAttendances = attendances.filter(att => att.status === 'purchased');
      const regularAttendances = attendances.filter(att => att.status === 'attended');

      console.log(`[User.updateAttendanceSummary] Found ${purchasedAttendances.length} purchased + ${regularAttendances.length} regular attendances`);

      // ✅ STEP 1: Calculate purchased streak (cumulative - mỗi purchased day +1 bất kể gaps)
      let purchasedStreak = purchasedAttendances.length;
      console.log(`[User.updateAttendanceSummary] Purchased streak: ${purchasedStreak} (cumulative)`);

      // ✅ STEP 2: Calculate regular streak (consecutive rules)
      let regularCurrentStreak = 0;
      let regularLongestStreak = 0;

      if (regularAttendances.length > 0) {
        let tempRegularStreak = 0;
        let lastRegularDate = null;

        // Process regular attendances to find consecutive streaks
        for (const attendance of regularAttendances) {
          const attendanceDate = new Date(attendance.year, attendance.month, attendance.day);
          attendanceDate.setHours(0, 0, 0, 0);

          if (lastRegularDate) {
            const dayDiff = (attendanceDate - lastRegularDate) / (1000 * 60 * 60 * 24);

            if (dayDiff === 1) {
              // Consecutive day
              tempRegularStreak++;
            } else if (dayDiff > 1) {
              // Gap found - update longest and reset temp
              regularLongestStreak = Math.max(regularLongestStreak, tempRegularStreak);
              tempRegularStreak = 1;
            }
          } else {
            tempRegularStreak = 1;
          }

          lastRegularDate = attendanceDate;
        }

        // Update longest streak with final temp streak
        regularLongestStreak = Math.max(regularLongestStreak, tempRegularStreak);

        // Check if regular streak is still active (within 1 day of today)
        if (lastRegularDate) {
          const daysSinceLastRegular = (today - lastRegularDate) / (1000 * 60 * 60 * 24);
          if (daysSinceLastRegular <= 1) {
            regularCurrentStreak = tempRegularStreak;
          } else {
            regularCurrentStreak = 0; // Regular streak expired
          }
        }

        console.log(`[User.updateAttendanceSummary] Regular streak: current=${regularCurrentStreak}, longest=${regularLongestStreak}`);

        // Update last attendance date
        if (lastRegularDate) {
          lastAttendanceDate = lastRegularDate;
        }
      }

      // ✅ STEP 3: Set last attendance date from purchased if more recent
      if (purchasedAttendances.length > 0) {
        const lastPurchased = purchasedAttendances[purchasedAttendances.length - 1];
        const lastPurchasedDate = new Date(lastPurchased.year, lastPurchased.month, lastPurchased.day);
        lastPurchasedDate.setHours(0, 0, 0, 0);

        if (!lastAttendanceDate || lastPurchasedDate > lastAttendanceDate) {
          lastAttendanceDate = lastPurchasedDate;
        }
      }

      // ✅ STEP 4: Combine results - purchased (cumulative) + regular (consecutive)
      currentStreak = purchasedStreak + regularCurrentStreak;
      longestStreak = purchasedStreak + regularLongestStreak;
      tempStreak = currentStreak;

      console.log(`[User.updateAttendanceSummary] Final cumulative results:`);
      console.log(`[User.updateAttendanceSummary] - Purchased streak: ${purchasedStreak} (cumulative)`);
      console.log(`[User.updateAttendanceSummary] - Regular current: ${regularCurrentStreak}, longest: ${regularLongestStreak}`);
      console.log(`[User.updateAttendanceSummary] - Combined current: ${currentStreak} (${purchasedStreak}+${regularCurrentStreak})`);
      console.log(`[User.updateAttendanceSummary] - Combined longest: ${longestStreak} (${purchasedStreak}+${regularLongestStreak})`);
      console.log(`[User.updateAttendanceSummary] - Total days: ${attendances.length}`);
      console.log(`[User.updateAttendanceSummary] - Last attendance: ${lastAttendanceDate?.toISOString().split('T')[0]}`);

      // Update longest streak with final temp streak
      longestStreak = Math.max(longestStreak, tempStreak);

      // ✅ Current streak already calculated above in the new logic
      // No additional calculation needed as we've already combined purchased + regular streaks

      // Update user stats
      this.attendance_summary.total_days = totalDays;
      this.attendance_summary.current_streak = currentStreak;
      this.attendance_summary.longest_streak = longestStreak;
      this.attendance_summary.last_attendance = lastAttendanceDate;

      await this.save();

      console.log(`[User.updateAttendanceSummary] ✅ Updated for user ${this._id}:`);
      console.log(`  - Total days: ${totalDays}`);
      console.log(`  - Current streak: ${currentStreak}`);
      console.log(`  - Longest streak: ${longestStreak}`);
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

    // ✅ Create transaction record for coin addition
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

      // ✅ Generate unique transaction ID với timestamp và random
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const transactionId = `REWARD_${this._id}_${timestamp}_${random}`;

      console.log(`[User.addCoins] Creating transaction: ${transactionId}`);
      console.log(`[User.addCoins] Description: ${description}`);
      console.log(`[User.addCoins] Amount: +${amount} xu`);

      const transactionData = {
        user_id: this._id,
        transaction_id: transactionId,
        description: description,
        coin_change: amount, // Positive for reward
        type: 'attendance', // ✅ Use 'attendance' type for consistency
        direction: 'in',
        status: 'completed',
        reference_type: 'attendance',
        balance_after: this.coin, // ✅ Add balance_after field
        metadata: {
          ...metadata,
          transaction_type: 'attendance_reward',
          user_coin_before: this.coin - amount,
          user_coin_after: this.coin
        }
      };

      console.log(`[User.addCoins] Transaction data:`, JSON.stringify(transactionData, null, 2));

      const transaction = await Transaction.create(transactionData);

      console.log(`[User.addCoins] ✅ Created transaction record: ${transaction._id} (+${amount} xu for user ${this._id})`);

    } catch (transactionError) {
      console.error(`[User.addCoins] ❌ Error creating transaction record:`, transactionError);
      console.error(`[User.addCoins] ❌ Error details:`, transactionError.message);
      console.error(`[User.addCoins] ❌ Error stack:`, transactionError.stack);
      // Don't throw error to avoid breaking the main flow
    }

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