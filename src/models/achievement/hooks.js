/**
 * Định nghĩa các hooks cho Achievement model
 * @param {Object} schema - Schema của Achievement model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Thực hiện trước khi lưu document
   */
  schema.pre('save', function(next) {
    // Đảm bảo rằng các thành tựu bị khóa cũng bị ẩn
    if (this.locked) {
      this.hidden = true;
    }
    
    next();
  });
};

module.exports = setupHooks;
