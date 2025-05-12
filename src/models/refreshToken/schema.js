const mongoose = require('mongoose');

/**
 * Schema cho refresh token
 * Dùng để lưu các refresh token và tạo access token mới
 */
const refreshTokenSchema = new mongoose.Schema({
  // ID của user sở hữu token
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

module.exports = refreshTokenSchema;
