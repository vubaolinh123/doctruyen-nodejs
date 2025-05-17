/**
 * Định nghĩa các hooks cho AchievementProgress model
 * @param {Object} schema - Schema của AchievementProgress model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Thực hiện trước khi lưu document
   */
  schema.pre('save', function(next) {
    // Đảm bảo rằng current_progress không âm
    if (this.current_progress < 0) {
      this.current_progress = 0;
    }
    
    next();
  });
};

module.exports = setupHooks;
