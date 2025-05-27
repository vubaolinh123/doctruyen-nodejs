/**
 * AttendanceReward Virtual Properties
 */

module.exports = function(schema) {
  /**
   * Virtual: typeText - Hiển thị loại phần thưởng bằng tiếng Việt
   */
  schema.virtual('typeText').get(function() {
    switch (this.type) {
      case 'consecutive':
        return 'Điểm danh liên tiếp';
      case 'total':
        return 'Tổng số ngày điểm danh';
      default:
        return 'Không xác định';
    }
  });

  /**
   * Virtual: rewardTypeText - Hiển thị loại phần thưởng bằng tiếng Việt
   */
  schema.virtual('rewardTypeText').get(function() {
    switch (this.reward_type) {
      case 'coin':
        return 'Xu';
      case 'permission':
        return 'Quyền đặc biệt';
      default:
        return 'Không xác định';
    }
  });

  /**
   * Virtual: fullTitle - Tiêu đề đầy đủ với số ngày
   */
  schema.virtual('fullTitle').get(function() {
    const typeText = this.type === 'consecutive' ? 'liên tiếp' : 'tổng cộng';
    return `${this.title} (${this.required_days} ngày ${typeText})`;
  });

  /**
   * Virtual: rewardDisplay - Hiển thị phần thưởng
   */
  schema.virtual('rewardDisplay').get(function() {
    if (this.reward_type === 'coin') {
      return `${this.reward_value.toLocaleString()} xu`;
    } else if (this.reward_type === 'permission' && this.permission_id) {
      return `Quyền: ${this.permission_id.name || 'Đặc biệt'}`;
    }
    return 'Phần thưởng đặc biệt';
  });

  /**
   * Virtual: statusText - Trạng thái hoạt động
   */
  schema.virtual('statusText').get(function() {
    return this.is_active ? 'Đang hoạt động' : 'Đã tắt';
  });

  /**
   * Virtual: slug - Slug cho URL
   */
  schema.virtual('slug').get(function() {
    return this.generateSlug();
  });

  /**
   * Virtual: sortOrder - Thứ tự sắp xếp
   */
  schema.virtual('sortOrder').get(function() {
    // consecutive rewards có priority cao hơn total rewards
    const typeOrder = this.type === 'consecutive' ? 1 : 2;
    return typeOrder * 1000 + this.required_days;
  });

  // Đảm bảo virtuals được include khi convert to JSON
  schema.set('toJSON', { virtuals: true });
  schema.set('toObject', { virtuals: true });
};
