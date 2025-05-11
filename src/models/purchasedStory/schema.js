const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho truyện đã mua
 * Lưu thông tin truyện đã mua của người dùng
 */
const purchasedStorySchema = new Schema({
  // Tham chiếu đến người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Tham chiếu đến truyện
  story_id: {
    type: Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
    index: true
  },

  // Số xu đã mua
  coin_bought: {
    type: Number,
    required: true,
    min: 0
  },

  // Trạng thái mua
  status: {
    type: String,
    enum: ['active', 'expired', 'refunded'],
    default: 'active',
    index: true
  },

  // Ngày hết hạn (nếu có)
  expire_date: {
    type: Date,
    default: null
  },

  // Tham chiếu đến giao dịch
  transaction_id: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
purchasedStorySchema.index({ user_id: 1, story_id: 1 }, { unique: true });
purchasedStorySchema.index({ user_id: 1, createdAt: -1 });
purchasedStorySchema.index({ expire_date: 1 }, { sparse: true });

module.exports = purchasedStorySchema; 