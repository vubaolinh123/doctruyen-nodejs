/**
 * Định nghĩa các instance methods cho TokenBlacklist model
 * @param {Object} schema - Schema của TokenBlacklist model
 */
const setupMethods = (schema) => {
  /**
   * Kiểm tra token có hết hạn chưa
   * @returns {boolean} - true nếu token đã hết hạn
   */
  schema.methods.isExpired = function() {
    return new Date() > this.expiresAt;
  };
};

module.exports = setupMethods;
