/**
 * AttendanceReward Instance Methods
 */

module.exports = function(schema) {
  /**
   * Kiểm tra xem user có đủ điều kiện nhận thưởng không
   * @param {Number} userConsecutiveDays - Số ngày điểm danh liên tiếp của user
   * @param {Number} userTotalDays - Tổng số ngày điểm danh của user
   * @returns {Boolean} - True nếu đủ điều kiện
   */
  schema.methods.isEligible = function(userConsecutiveDays, userTotalDays) {
    if (!this.is_active) {
      return false;
    }

    if (this.type === 'consecutive') {
      return userConsecutiveDays >= this.required_days;
    } else if (this.type === 'total') {
      return userTotalDays >= this.required_days;
    }

    return false;
  };

  /**
   * Lấy thông tin phần thưởng dạng text
   * @returns {String} - Mô tả phần thưởng
   */
  schema.methods.getRewardText = function() {
    if (this.reward_type === 'coin') {
      return `${this.reward_value} xu`;
    } else if (this.reward_type === 'permission' && this.permission_id) {
      return `Quyền: ${this.permission_id.name || 'Đặc biệt'}`;
    }
    return 'Phần thưởng đặc biệt';
  };

  /**
   * Lấy progress percentage cho user
   * @param {Number} userConsecutiveDays - Số ngày điểm danh liên tiếp của user
   * @param {Number} userTotalDays - Tổng số ngày điểm danh của user
   * @returns {Number} - Phần trăm hoàn thành (0-100)
   */
  schema.methods.getProgress = function(userConsecutiveDays, userTotalDays) {
    let currentDays = 0;
    
    if (this.type === 'consecutive') {
      currentDays = userConsecutiveDays;
    } else if (this.type === 'total') {
      currentDays = userTotalDays;
    }

    const progress = Math.min((currentDays / this.required_days) * 100, 100);
    return Math.round(progress);
  };

  /**
   * Kiểm tra xem có phải mốc mới đạt được không
   * @param {Number} oldConsecutiveDays - Số ngày liên tiếp cũ
   * @param {Number} newConsecutiveDays - Số ngày liên tiếp mới
   * @param {Number} oldTotalDays - Tổng số ngày cũ
   * @param {Number} newTotalDays - Tổng số ngày mới
   * @returns {Boolean} - True nếu vừa đạt được mốc này
   */
  schema.methods.isNewlyAchieved = function(oldConsecutiveDays, newConsecutiveDays, oldTotalDays, newTotalDays) {
    if (!this.is_active) {
      return false;
    }

    if (this.type === 'consecutive') {
      return oldConsecutiveDays < this.required_days && newConsecutiveDays >= this.required_days;
    } else if (this.type === 'total') {
      return oldTotalDays < this.required_days && newTotalDays >= this.required_days;
    }

    return false;
  };

  /**
   * Validate dữ liệu trước khi save
   */
  schema.methods.validateReward = function() {
    const errors = [];

    // Kiểm tra required_days
    if (!this.required_days || this.required_days <= 0) {
      errors.push('Số ngày yêu cầu phải lớn hơn 0');
    }

    // Kiểm tra reward_type và các trường liên quan
    if (this.reward_type === 'coin') {
      if (!this.reward_value || this.reward_value <= 0) {
        errors.push('Giá trị xu phải lớn hơn 0 khi loại phần thưởng là coin');
      }
      // Clear permission_id nếu reward_type là coin
      this.permission_id = null;
    } else if (this.reward_type === 'permission') {
      if (!this.permission_id) {
        errors.push('Permission ID là bắt buộc khi loại phần thưởng là permission');
      }
      // Clear reward_value nếu reward_type là permission
      this.reward_value = 0;
    }

    // Kiểm tra title và description
    if (!this.title || this.title.trim().length === 0) {
      errors.push('Tên mốc phần thưởng là bắt buộc');
    }

    if (!this.description || this.description.trim().length === 0) {
      errors.push('Mô tả phần thưởng là bắt buộc');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    return true;
  };

  /**
   * Tạo slug cho mốc phần thưởng (để dùng trong URL nếu cần)
   * @returns {String} - Slug
   */
  schema.methods.generateSlug = function() {
    const typeText = this.type === 'consecutive' ? 'lien-tiep' : 'tong-cong';
    return `${typeText}-${this.required_days}-ngay`;
  };
};
