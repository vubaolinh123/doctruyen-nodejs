const mongoose = require('mongoose');

/**
 * Schema cho danh sách token bị vô hiệu hóa
 * Dùng để lưu các token đã đăng xuất hoặc bị vô hiệu hóa
 */
const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  // Thời gian hết hạn của token, dùng để xóa token khỏi blacklist sau khi hết hạn
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Tự động xóa document khi hết hạn
  },
  // Thông tin bổ sung về lý do vô hiệu hóa token
  reason: {
    type: String,
    enum: ['LOGOUT', 'PASSWORD_CHANGE', 'SECURITY_ISSUE', 'OTHER'],
    default: 'LOGOUT'
  },
  // Thời gian tạo và cập nhật
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Tạo model
const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

module.exports = { TokenBlacklist };
