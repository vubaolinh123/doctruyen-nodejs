const crypto = require('crypto');

/**
 * Định nghĩa các static methods cho RefreshToken model
 * @param {Object} schema - Schema của RefreshToken model
 */
const setupStatics = (schema) => {
  /**
   * Tạo refresh token mới
   * @param {string} userId - ID của user
   * @param {string} userAgent - User agent của trình duyệt
   * @param {string} ipAddress - IP của người dùng
   * @param {number} expiresIn - Thời gian hết hạn tính bằng giây
   * @returns {Promise<Object>} - Refresh token object
   */
  schema.statics.generateToken = async function(userId, userAgent = '', ipAddress = '', expiresIn = 30 * 24 * 60 * 60) { // 30 days
    // Tạo token ngẫu nhiên
    const token = crypto.randomBytes(40).toString('hex');
    
    // Tính thời gian hết hạn
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
    
    // Tạo refresh token mới
    const refreshToken = await this.create({
      userId,
      token,
      userAgent,
      ipAddress,
      expiresAt
    });
    
    return refreshToken;
  };

  /**
   * Vô hiệu hóa tất cả refresh token của user
   * @param {string} userId - ID của user
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  schema.statics.revokeAllForUser = async function(userId) {
    return this.updateMany(
      { userId, status: 'active' },
      { status: 'revoked' }
    );
  };

  /**
   * Tìm token theo giá trị token
   * @param {string} token - Giá trị token
   * @returns {Promise<Object>} - RefreshToken tìm thấy
   */
  schema.statics.findByToken = function(token) {
    return this.findOne({ token });
  };

  /**
   * Tìm tất cả token của user
   * @param {string} userId - ID của user
   * @returns {Promise<Array>} - Danh sách token
   */
  schema.statics.findAllForUser = function(userId) {
    return this.find({ userId }).sort({ createdAt: -1 });
  };

  /**
   * Tìm tất cả token active của user
   * @param {string} userId - ID của user
   * @returns {Promise<Array>} - Danh sách token active
   */
  schema.statics.findActiveForUser = function(userId) {
    return this.find({ userId, status: 'active' }).sort({ createdAt: -1 });
  };

  /**
   * Xóa token theo giá trị token
   * @param {string} token - Giá trị token
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.statics.deleteByToken = function(token) {
    return this.deleteOne({ token });
  };

  /**
   * Xóa tất cả token của user
   * @param {string} userId - ID của user
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.statics.deleteAllForUser = function(userId) {
    return this.deleteMany({ userId });
  };
};

module.exports = setupStatics;
