/**
 * Định nghĩa các hooks cho RefreshToken model
 * @param {Object} schema - Schema của RefreshToken model
 */
const setupHooks = (schema) => {
  // Pre-save hook
  schema.pre('save', function(next) {
    // Đảm bảo expiresAt luôn là một Date object
    if (this.expiresAt && !(this.expiresAt instanceof Date)) {
      this.expiresAt = new Date(this.expiresAt);
    }
    next();
  });
};

module.exports = setupHooks;
