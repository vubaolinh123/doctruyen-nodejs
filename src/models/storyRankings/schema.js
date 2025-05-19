const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho xếp hạng truyện
 * Lưu thông tin xếp hạng của truyện theo các khoảng thời gian
 */
const storyRankingsSchema = new Schema({
  // Tham chiếu đến truyện
  story_id: {
    type: Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
    index: true
  },
  
  // Ngày xếp hạng
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  // Điểm xếp hạng theo ngày
  daily_score: {
    type: Number,
    default: 0
  },
  
  // Điểm xếp hạng theo tuần
  weekly_score: {
    type: Number,
    default: 0
  },
  
  // Điểm xếp hạng theo tháng
  monthly_score: {
    type: Number,
    default: 0
  },
  
  // Điểm xếp hạng toàn thời gian
  all_time_score: {
    type: Number,
    default: 0
  },
  
  // Thứ hạng theo ngày
  daily_rank: {
    type: Number,
    default: 0,
    index: true
  },
  
  // Thứ hạng theo tuần
  weekly_rank: {
    type: Number,
    default: 0,
    index: true
  },
  
  // Thứ hạng theo tháng
  monthly_rank: {
    type: Number,
    default: 0,
    index: true
  },
  
  // Thứ hạng toàn thời gian
  all_time_rank: {
    type: Number,
    default: 0,
    index: true
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
storyRankingsSchema.index({ story_id: 1, date: 1 }, { unique: true });
storyRankingsSchema.index({ date: 1 });
storyRankingsSchema.index({ year: 1, month: 1, day: 1 });
storyRankingsSchema.index({ year: 1, week: 1 });
storyRankingsSchema.index({ year: 1, month: 1 });

module.exports = storyRankingsSchema;
