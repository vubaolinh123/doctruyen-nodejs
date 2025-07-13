/**
 * UserAttendanceReward Instance Methods
 */

module.exports = function(schema) {
  /**
   * Kiểm tra xem bản ghi này có phải là claim trong tháng hiện tại không
   * @returns {Boolean} - True nếu là tháng hiện tại
   */
  schema.methods.isCurrentMonth = function() {
    const now = new Date();
    return this.month === now.getMonth() && this.year === now.getFullYear();
  };

  /**
   * Lấy text hiển thị thời gian nhận thưởng
   * @returns {String} - Text thời gian
   */
  schema.methods.getClaimedTimeText = function() {
    const months = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];

    return `${months[this.month]} ${this.year}`;
  };

  /**
   * Lấy text hiển thị phần thưởng đã nhận
   * @returns {String} - Text phần thưởng
   */
  schema.methods.getRewardText = function() {
    if (this.reward_type === 'coin') {
      return `${this.reward_value.toLocaleString()} xu`;
    } else if (this.reward_type === 'permission' && this.permission_id) {
      return `Quyền: ${this.permission_id.name || 'Đặc biệt'}`;
    }
    return 'Phần thưởng đặc biệt';
  };

  /**
   * Kiểm tra xem có phải là claim gần đây không (trong 24h)
   * @returns {Boolean} - True nếu là claim gần đây
   */
  schema.methods.isRecent = function() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return this.claimed_at >= oneDayAgo;
  };

  /**
   * Lấy thông tin tóm tắt của claim
   * @returns {Object} - Thông tin tóm tắt
   */
  schema.methods.getSummary = function() {
    return {
      id: this._id,
      rewardTitle: this.milestone_id?.title || 'Không xác định', // Updated field name
      rewardType: this.reward_type,
      rewardValue: this.reward_value,
      claimedAt: this.claimed_at,
      claimedTimeText: this.getClaimedTimeText(),
      rewardText: this.getRewardText(),
      isRecent: this.isRecent(),
      isCurrentMonth: this.isCurrentMonth(),
      milestoneType: this.milestone_type,
      daysAtClaim: this.days_at_claim
    };
  };

  /**
   * Validate dữ liệu trước khi save
   */
  schema.methods.validateClaim = function() {
    const errors = [];

    // Kiểm tra user_id và milestone_id (updated field name)
    if (!this.user_id) {
      errors.push('User ID là bắt buộc');
    }

    if (!this.milestone_id) {
      errors.push('Milestone ID là bắt buộc');
    }

    // Kiểm tra milestone_type (required field)
    if (!this.milestone_type) {
      errors.push('Milestone type là bắt buộc');
    } else if (!['monthly', 'lifetime'].includes(this.milestone_type)) {
      errors.push('Milestone type phải là monthly hoặc lifetime');
    }

    // Kiểm tra days_at_claim (required field)
    if (this.days_at_claim === undefined || this.days_at_claim === null) {
      errors.push('Days at claim là bắt buộc');
    } else if (this.days_at_claim < 0) {
      errors.push('Days at claim phải là số không âm');
    }

    // Kiểm tra month (conditionally required for monthly milestones)
    if (this.milestone_type === 'monthly') {
      if (this.month === undefined || this.month === null) {
        errors.push('Tháng là bắt buộc cho milestone monthly');
      } else if (this.month < 0 || this.month > 11) {
        errors.push('Tháng phải từ 0 đến 11');
      }
    }

    // Kiểm tra year
    if (!this.year) {
      errors.push('Năm là bắt buộc');
    } else if (this.year < 2020 || this.year > 2100) {
      errors.push('Năm không hợp lệ');
    }

    // Kiểm tra reward_type
    if (!this.reward_type) {
      errors.push('Reward type là bắt buộc');
    } else if (!['coin', 'permission'].includes(this.reward_type)) {
      errors.push('Loại phần thưởng không hợp lệ');
    }

    // Kiểm tra reward_value cho coin
    if (this.reward_type === 'coin' && this.reward_value <= 0) {
      errors.push('Giá trị xu phải lớn hơn 0');
    }

    // Kiểm tra permission_id cho permission
    if (this.reward_type === 'permission' && !this.permission_id) {
      errors.push('Permission ID là bắt buộc cho phần thưởng quyền');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    return true;
  };

  /**
   * Tạo notification message cho user
   * @returns {String} - Message thông báo
   */
  schema.methods.createNotificationMessage = function() {
    const rewardText = this.getRewardText();
    const timeText = this.getClaimedTimeText();
    
    return `Bạn đã nhận thưởng ${rewardText} từ mốc điểm danh trong ${timeText}!`;
  };

  /**
   * Kiểm tra xem claim này có hợp lệ không (chưa bị expire)
   * @returns {Boolean} - True nếu hợp lệ
   */
  schema.methods.isValid = function() {
    // Claim luôn hợp lệ sau khi đã tạo
    // Có thể thêm logic kiểm tra expire nếu cần
    return true;
  };
};
