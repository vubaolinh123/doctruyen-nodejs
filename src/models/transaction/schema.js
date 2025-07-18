const mongoose = require('mongoose');
const { Schema } = mongoose;
const vietnamTimezonePlugin = require('../../plugins/vietnamTimezone');

// Thêm phương thức getWeek cho Date để tính số tuần trong năm
Date.prototype.getWeek = function() {
  const date = new Date(this.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

/**
 * Schema cho giao dịch
 * Lưu thông tin các giao dịch xu/tiền của người dùng
 */
const transactionSchema = new Schema({
  // ID của người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Mã giao dịch
  transaction_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Mô tả giao dịch
  description: {
    type: String,
    default: ''
  },

  // Ngày giao dịch
  transaction_date: {
    type: Date,
    default: () => {
      // Use Vietnam timezone utility
      const { getVietnamNowForAPI } = require('../../utils/timezone');
      return new Date(getVietnamNowForAPI());
    },
    index: true
  },

  // Số xu tăng/giảm
  coin_change: {
    type: Number,
    default: 0
  },

  // Loại giao dịch
  type: {
    type: String,
    enum: ['attendance', 'purchase', 'reward', 'admin', 'refund', 'other', 'add', 'subtract', 'update', 'sepay_deposit'],
    default: 'other',
    index: true
  },

  // Hướng giao dịch (tăng/giảm)
  direction: {
    type: String,
    enum: ['in', 'out'],
    default: function() {
      return this.coin_change >= 0 ? 'in' : 'out';
    },
    index: true
  },

  // Số dư sau giao dịch
  balance_after: {
    type: Number,
    default: 0
  },

  // Trạng thái giao dịch
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed',
    index: true
  },

  // Tham chiếu đến đối tượng liên quan (nếu có)
  reference_type: {
    type: String,
    enum: ['story', 'chapter', 'attendance', 'mission', 'achievement', 'milestone', 'author_registration', 'author_rejection', 'author_approval', 'payment', 'other', ''],
    default: ''
  },

  reference_id: {
    type: Schema.Types.ObjectId,
    default: null
  },

  // Metadata bổ sung
  metadata: {
    type: Object,
    default: {}
  },

  // Trường tương thích ngược - sẽ loại bỏ trong tương lai
  users_id: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  up_point: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
transactionSchema.index({ transaction_date: -1 });
transactionSchema.index({ user_id: 1, transaction_date: -1 });
transactionSchema.index({ type: 1, transaction_date: -1 });

module.exports = transactionSchema; 