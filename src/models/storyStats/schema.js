const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho thống kê truyện theo thời gian
 * Lưu thông tin thống kê của truyện theo ngày
 */
const storyStatsSchema = new Schema({
  // Tham chiếu đến truyện
  story_id: {
    type: Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
    index: true
  },
  
  // Ngày thống kê
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  // Thông tin lượt xem
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Lượt xem độc nhất (unique views)
  unique_views: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Thông tin đánh giá
  ratings_count: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Tổng điểm đánh giá
  ratings_sum: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Số lượt bình luận
  comments_count: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Số lượt bookmark
  bookmarks_count: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Số lượt chia sẻ
  shares_count: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Thông tin thời gian để dễ truy vấn
  day: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  
  month: {
    type: Number,
    required: true,
    min: 0,
    max: 11
  },
  
  year: {
    type: Number,
    required: true,
    min: 2000
  },
  
  // Tuần trong năm (1-53)
  week: {
    type: Number,
    required: true,
    min: 1,
    max: 53
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo index cho các trường tìm kiếm phổ biến
storyStatsSchema.index({ story_id: 1, date: 1 }, { unique: true });
storyStatsSchema.index({ date: 1 });
storyStatsSchema.index({ year: 1, month: 1, day: 1 });
storyStatsSchema.index({ year: 1, week: 1 });
storyStatsSchema.index({ year: 1, month: 1 });

module.exports = storyStatsSchema;
