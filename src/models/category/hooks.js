const slugify = require('slugify');

/**
 * Định nghĩa các hooks cho Category model
 * @param {Object} schema - Schema của Category model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Tự động tạo slug nếu chưa có
   */
  schema.pre('save', function(next) {
    // Tạo slug nếu chưa có
    if (!this.slug && this.name) {
      this.slug = slugify(this.name, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
    }

    next();
  });
};

module.exports = setupHooks;
