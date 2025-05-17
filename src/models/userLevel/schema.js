const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho cấp độ người dùng
 * Lưu thông tin cấp độ và kinh nghiệm của người dùng
 */
const userLevelSchema = new Schema({
  // ID của người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Cấp độ hiện tại
  level: {
    type: Number,
    default: 1,
    min: 1,
    index: true
  },
  
  // Kinh nghiệm hiện tại
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Kinh nghiệm cần thiết để lên cấp tiếp theo
  next_level_exp: {
    type: Number,
    default: 100,
    min: 0
  },
  
  // Tổng kinh nghiệm đã nhận
  total_experience: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Lịch sử nhận kinh nghiệm
  experience_history: [{
    // Số kinh nghiệm nhận được
    amount: {
      type: Number,
      required: true
    },
    
    // Nguồn kinh nghiệm
    source: {
      type: String,
      enum: ['mission', 'achievement', 'reading', 'comment', 'attendance', 'admin', 'other'],
      default: 'other'
    },
    
    // Thời gian nhận
    timestamp: {
      type: Date,
      default: Date.now
    },
    
    // Metadata bổ sung
    metadata: {
      type: Object,
      default: {}
    }
  }],
  
  // Các đặc quyền đã mở khóa
  unlocked_privileges: [{
    // Loại đặc quyền
    type: {
      type: String,
      enum: ['frame', 'nameColor', 'chatColor', 'badge', 'feature', 'other'],
      required: true
    },
    
    // Giá trị đặc quyền
    value: {
      type: Schema.Types.Mixed,
      required: true
    },
    
    // Cấp độ mở khóa
    unlocked_at_level: {
      type: Number,
      required: true
    },
    
    // Thời gian mở khóa
    unlocked_at: {
      type: Date,
      default: Date.now
    },
    
    // Trạng thái kích hoạt
    active: {
      type: Boolean,
      default: true
    }
  }],
  
  // Thống kê
  stats: {
    // Thời gian lên cấp gần nhất
    last_level_up: {
      type: Date,
      default: null
    },
    
    // Cấp độ cao nhất đạt được
    highest_level: {
      type: Number,
      default: 1,
      min: 1
    },
    
    // Tốc độ tăng cấp trung bình (cấp/ngày)
    average_level_rate: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo index cho các trường tìm kiếm phổ biến
userLevelSchema.index({ level: -1 });
userLevelSchema.index({ 'stats.highest_level': -1 });

module.exports = userLevelSchema;
