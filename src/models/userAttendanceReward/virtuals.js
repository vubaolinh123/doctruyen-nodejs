/**
 * UserAttendanceReward Virtual Properties
 */

module.exports = function(schema) {
  /**
   * Virtual: claimedTimeText - Hiển thị thời gian nhận thưởng
   */
  schema.virtual('claimedTimeText').get(function() {
    return this.getClaimedTimeText();
  });

  /**
   * Virtual: rewardText - Hiển thị phần thưởng đã nhận
   */
  schema.virtual('rewardText').get(function() {
    return this.getRewardText();
  });

  /**
   * Virtual: isRecentClaim - Kiểm tra xem có phải claim gần đây không
   */
  schema.virtual('isRecentClaim').get(function() {
    return this.isRecent();
  });

  /**
   * Virtual: isCurrentMonthClaim - Kiểm tra xem có phải tháng hiện tại không
   */
  schema.virtual('isCurrentMonthClaim').get(function() {
    return this.isCurrentMonth();
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
   * Virtual: claimedDateFormatted - Định dạng ngày nhận thưởng
   */
  schema.virtual('claimedDateFormatted').get(function() {
    if (!this.claimed_at) return '';

    const date = new Date(this.claimed_at);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  });

  /**
   * Virtual: summary - Thông tin tóm tắt
   */
  schema.virtual('summary').get(function() {
    return this.getSummary();
  });

  /**
   * Virtual: notificationMessage - Message thông báo
   */
  schema.virtual('notificationMessage').get(function() {
    return this.createNotificationMessage();
  });

  /**
   * Virtual: daysSinceClaimed - Số ngày kể từ khi nhận thưởng
   */
  schema.virtual('daysSinceClaimed').get(function() {
    if (!this.claimed_at) return 0;

    const now = new Date();
    const claimedDate = new Date(this.claimed_at);
    const diffTime = Math.abs(now - claimedDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  });

  /**
   * Virtual: isValidClaim - Kiểm tra tính hợp lệ
   */
  schema.virtual('isValidClaim').get(function() {
    return this.isValid();
  });

  // Đảm bảo virtuals được include khi convert to JSON
  schema.set('toJSON', { virtuals: true });
  schema.set('toObject', { virtuals: true });
};
