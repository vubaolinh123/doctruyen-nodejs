/**
 * Định nghĩa các instance methods cho RefreshToken model
 * @param {Object} schema - Schema của RefreshToken model
 */
const setupMethods = (schema) => {
  /**
   * Vô hiệu hóa refresh token
   * @returns {Promise<Object>} - RefreshToken đã cập nhật
   */
  schema.methods.revoke = async function() {
    this.status = 'revoked';
    return this.save();
  };

  /**
   * Kiểm tra token có hết hạn chưa
   * @returns {boolean} - true nếu token đã hết hạn
   */
  schema.methods.isExpired = function() {
    return new Date() > this.expiresAt;
  };

  /**
   * Kiểm tra token có bị vô hiệu hóa không
   * @returns {boolean} - true nếu token đã bị vô hiệu hóa
   */
  schema.methods.isRevoked = function() {
    return this.status === 'revoked';
  };

  /**
   * Kiểm tra token có hợp lệ không
   * @returns {boolean} - true nếu token còn hợp lệ
   */
  schema.methods.isValid = function() {
    return !this.isExpired() && !this.isRevoked();
  };
};

module.exports = setupMethods;
