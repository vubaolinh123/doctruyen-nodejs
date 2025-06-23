const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho mua hàng của người dùng (user-centric approach)
 * Tối ưu hóa để lưu tất cả purchases của một user trong một document
 */
const userPurchasesSchema = new Schema({
  // Tham chiếu đến người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // Danh sách truyện đã mua
  purchasedStories: [{
    story_id: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true
    },
    price_paid: {
      type: Number,
      required: true,
      min: 0
    },
    purchase_date: {
      type: Date,
      default: Date.now
    },
    transaction_id: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'refunded'],
      default: 'active'
    },
    expire_date: {
      type: Date,
      default: null
    }
  }],

  // Danh sách chapter đã mua
  purchasedChapters: [{
    chapter_id: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true
    },
    story_id: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true
    },
    price_paid: {
      type: Number,
      required: true,
      min: 0
    },
    purchase_date: {
      type: Date,
      default: Date.now
    },
    transaction_id: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'refunded'],
      default: 'active'
    },
    expire_date: {
      type: Date,
      default: null
    }
  }],

  // Thống kê tổng quan
  stats: {
    total_stories_purchased: {
      type: Number,
      default: 0,
      min: 0
    },
    total_chapters_purchased: {
      type: Number,
      default: 0,
      min: 0
    },
    total_coins_spent: {
      type: Number,
      default: 0,
      min: 0
    },
    first_purchase_date: {
      type: Date,
      default: null
    },
    last_purchase_date: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
userPurchasesSchema.index({ user_id: 1 });
userPurchasesSchema.index({ 'purchasedStories.story_id': 1 });
userPurchasesSchema.index({ 'purchasedChapters.chapter_id': 1 });
userPurchasesSchema.index({ 'purchasedStories.purchase_date': -1 });
userPurchasesSchema.index({ 'purchasedChapters.purchase_date': -1 });

module.exports = userPurchasesSchema;
