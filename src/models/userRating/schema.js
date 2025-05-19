const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho đánh giá của người dùng
 * Lưu thông tin đánh giá của người dùng cho truyện
 */
const userRatingSchema = new Schema({
  // Tham chiếu đến người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
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
  
  // Điểm đánh giá (1-10)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo index cho cặp user_id và story_id để tìm kiếm nhanh hơn và đảm bảo duy nhất
userRatingSchema.index({ user_id: 1, story_id: 1 }, { unique: true });

module.exports = userRatingSchema;
