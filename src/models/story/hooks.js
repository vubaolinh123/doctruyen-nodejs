const slugify = require('slugify');

/**
 * Định nghĩa các hooks cho Story model
 * @param {Object} schema - Schema của Story model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Tự động tạo slug nếu chưa có và validate business logic
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

    // BUSINESS LOGIC VALIDATION: isPaid và hasPaidChapters không được cùng true
    if (this.isPaid === true && this.hasPaidChapters === true) {
      const error = new Error('Business Logic Violation: isPaid và hasPaidChapters không thể cùng là true. Chỉ được chọn một trong hai mô hình: Story-level purchase (isPaid=true) hoặc Chapter-level purchase (hasPaidChapters=true)');
      error.name = 'ValidationError';
      return next(error);
    }

    // BUSINESS LOGIC VALIDATION: Nếu isPaid = true thì price phải > 0
    if (this.isPaid === true && (!this.price || this.price <= 0)) {
      const error = new Error('Business Logic Violation: Truyện trả phí (isPaid=true) phải có giá > 0');
      error.name = 'ValidationError';
      return next(error);
    }

    next();
  });
};

module.exports = setupHooks;
