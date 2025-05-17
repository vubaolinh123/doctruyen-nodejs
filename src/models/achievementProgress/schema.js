const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho tiến trình thành tựu
 * Lưu thông tin tiến trình đạt được thành tựu của người dùng
 */
const achievementProgressSchema = new Schema({
  // ID của người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // ID của thành tựu
  achievement_id: {
    type: Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true,
    index: true
  },
  
  // Tiến trình hiện tại
  current_progress: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Trạng thái hoàn thành
  completed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Thời gian hoàn thành
  completed_at: {
    type: Date,
    default: null
  },
  
  // Trạng thái nhận thưởng
  rewarded: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Thời gian nhận thưởng
  rewarded_at: {
    type: Date,
    default: null
  },
  
  // Metadata bổ sung
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo index cho các trường tìm kiếm phổ biến
achievementProgressSchema.index({ user_id: 1, achievement_id: 1 }, { unique: true });
achievementProgressSchema.index({ user_id: 1, completed: 1 });
achievementProgressSchema.index({ user_id: 1, rewarded: 1 });

module.exports = achievementProgressSchema;
