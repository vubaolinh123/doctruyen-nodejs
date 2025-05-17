const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho tiến trình nhiệm vụ
 * Lưu thông tin tiến trình hoàn thành nhiệm vụ của người dùng
 */
const missionProgressSchema = new Schema({
  // ID của người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // ID của nhiệm vụ
  mission_id: {
    type: Schema.Types.ObjectId,
    ref: 'Mission',
    required: true,
    index: true
  },
  
  // Tiến trình hiện tại
  current_progress: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Tiến trình của các nhiệm vụ con (nếu có)
  sub_progress: [{
    sub_mission_index: {
      type: Number,
      required: true
    },
    
    current_progress: {
      type: Number,
      default: 0,
      min: 0
    },
    
    completed: {
      type: Boolean,
      default: false
    }
  }],
  
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
  
  // Thời gian làm mới (reset)
  reset_at: {
    type: Date,
    default: null
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
  
  // Tuần trong năm (cho nhiệm vụ hàng tuần)
  week: {
    type: Number,
    default: 0,
    min: 0,
    max: 53
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo index cho các trường tìm kiếm phổ biến
missionProgressSchema.index({ user_id: 1, mission_id: 1, year: 1, month: 1, day: 1 }, { unique: true });
missionProgressSchema.index({ user_id: 1, completed: 1 });
missionProgressSchema.index({ user_id: 1, rewarded: 1 });
missionProgressSchema.index({ user_id: 1, year: 1, week: 1 });

module.exports = missionProgressSchema;
