/**
 * Định nghĩa các hooks cho User model
 * @param {Object} schema - Schema của User model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Tự động tạo slug nếu chưa có
   */
  schema.pre('save', async function(next) {
    if (this.isNew || this.isModified('name')) {
      if (!this.slug) {
        try {
          this.slug = await this.constructor.generateUniqueSlug(this.name);
        } catch (error) {
          return next(error);
        }
      }
    }
    next();
  });

  /**
   * Pre-validate hook
   * Chuẩn hóa email sang chữ thường
   */
  schema.pre('validate', function(next) {
    if (this.email) {
      this.email = this.email.toLowerCase();
    }
    next();
  });
};

module.exports = setupHooks; 