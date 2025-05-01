const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Schema cho refresh token
 * Dùng để lưu các refresh token và tạo access token mới
 */
const refreshTokenSchema = new mongoose.Schema({
  // ID của user sở hữu token
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  // Token value
  token: {
    type: String,
    required: true,
    unique: true
  },
  // Thông tin thiết bị đăng nhập
  userAgent: {
    type: String,
    default: ''
  },
  // IP của người dùng
  ipAddress: {
    type: String,
    default: ''
  },
  // Thời gian hết hạn
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Tự động xóa document khi hết hạn
  },
  // Trạng thái: active, revoked
  status: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active'
  },
  // Thời gian tạo và cập nhật
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index để tìm kiếm token nhanh hơn
refreshTokenSchema.index({ userId: 1 });

/**
 * Tạo refresh token mới
 * @param {string} userId - ID của user
 * @param {string} userAgent - User agent của trình duyệt
 * @param {string} ipAddress - IP của người dùng
 * @param {number} expiresIn - Thời gian hết hạn tính bằng giây
 * @returns {Object} - Refresh token object
 */
refreshTokenSchema.statics.generateToken = async function(userId, userAgent = '', ipAddress = '', expiresIn = 30 * 24 * 60 * 60) { // 30 days
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
 * Vô hiệu hóa refresh token
 */
refreshTokenSchema.methods.revoke = async function() {
  this.status = 'revoked';
  return this.save();
};

/**
 * Vô hiệu hóa tất cả refresh token của user
 * @param {string} userId - ID của user
 */
refreshTokenSchema.statics.revokeAllForUser = async function(userId) {
  return this.updateMany(
    { userId, status: 'active' },
    { status: 'revoked' }
  );
};

// Tạo model
const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = { RefreshToken };
