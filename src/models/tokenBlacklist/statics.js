/**
 * Định nghĩa các static methods cho TokenBlacklist model
 * @param {Object} schema - Schema của TokenBlacklist model
 */
const setupStatics = (schema) => {
  /**
   * Thêm token vào blacklist
   * @param {string} token - Token cần thêm vào blacklist
   * @param {Date} expiresAt - Thời gian hết hạn của token
   * @param {string} reason - Lý do vô hiệu hóa token
   * @returns {Promise<Object>} - TokenBlacklist document
   */
  schema.statics.addToBlacklist = async function(token, expiresAt, reason = 'LOGOUT') {
    try {
      return await this.create({
        token,
        expiresAt,
        reason
      });
    } catch (error) {
      // Nếu token đã tồn tại trong blacklist, bỏ qua lỗi
      if (error.code === 11000) {
        return null;
      }
      throw error;
    }
  };

  /**
   * Kiểm tra token có trong blacklist không
   * @param {string} token - Token cần kiểm tra
   * @returns {Promise<boolean>} - true nếu token có trong blacklist
   */
  schema.statics.isBlacklisted = async function(token) {
    const count = await this.countDocuments({ token });
    return count > 0;
  };

  /**
   * Xóa token khỏi blacklist
   * @param {string} token - Token cần xóa
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.statics.removeFromBlacklist = function(token) {
    return this.deleteOne({ token });
  };

  /**
   * Xóa tất cả token hết hạn
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.statics.cleanupExpired = function() {
    return this.deleteMany({ expiresAt: { $lt: new Date() } });
  };
};

module.exports = setupStatics;
