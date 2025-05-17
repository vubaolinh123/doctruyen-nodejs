/**
 * Định nghĩa các hooks cho MissionProgress model
 * @param {Object} schema - Schema của MissionProgress model
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
    
    // Đảm bảo rằng sub_progress không âm
    if (this.sub_progress && this.sub_progress.length > 0) {
      this.sub_progress.forEach(sp => {
        if (sp.current_progress < 0) {
          sp.current_progress = 0;
        }
      });
    }
    
    next();
  });
};

module.exports = setupHooks;
