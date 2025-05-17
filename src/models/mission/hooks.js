/**
 * Định nghĩa các hooks cho Mission model
 * @param {Object} schema - Schema của Mission model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Thực hiện trước khi lưu document
   */
  schema.pre('save', function(next) {
    // Đảm bảo rằng các nhiệm vụ hàng ngày không có dayOfWeek
    if (this.type === 'daily') {
      this.resetTime.dayOfWeek = 0;
    }
    
    // Đảm bảo rằng các nhiệm vụ hàng tuần có dayOfWeek hợp lệ
    if (this.type === 'weekly' && (this.resetTime.dayOfWeek < 0 || this.resetTime.dayOfWeek > 6)) {
      this.resetTime.dayOfWeek = 0; // Mặc định là Chủ nhật
    }
    
    next();
  });
};

module.exports = setupHooks;
