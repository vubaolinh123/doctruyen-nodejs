const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho thành tựu
 * Lưu thông tin các thành tựu mà người dùng có thể đạt được
 */
const achievementSchema = new Schema({
  // Thông tin cơ bản
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    default: ''
  },
  
  // Đường dẫn đến icon
  icon: {
    type: String,
    default: ''
  },
  
  // Loại thành tựu
  category: {
    type: String,
    enum: ['all', 'reading', 'social', 'collection', 'special'],
    default: 'all',
    index: true
  },
  
  // Độ hiếm của thành tựu
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common',
    index: true
  },
  
  // Yêu cầu để đạt được thành tựu
  requirement: {
    // Loại yêu cầu
    type: {
      type: String,
      enum: [
        'read_chapter', 'comment', 'attendance', 'view_story', 'rate_story', 
        'collection', 'social', 'special', 'other'
      ],
      default: 'other'
    },
    
    // Số lượng cần hoàn thành
    count: {
      type: Number,
      default: 1,
      min: 1
    },
    
    // Các điều kiện bổ sung (nếu có)
    conditions: {
      type: Object,
      default: {}
    }
  },
  
  // Phần thưởng khi đạt được thành tựu
  reward: {
    // Loại phần thưởng
    type: {
      type: String,
      enum: ['xu', 'rank', 'frame', 'nameColor', 'chatColor', 'badge', 'other'],
      default: 'xu'
    },
    
    // Giá trị phần thưởng
    value: {
      type: Schema.Types.Mixed,
      default: 0
    },
    
    // Số xu thưởng
    coins: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Số điểm kinh nghiệm thưởng
    exp: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Các phần thưởng khác (nếu có)
    other: {
      type: Object,
      default: {}
    }
  },
  
  // Có ẩn thành tựu không
  hidden: {
    type: Boolean,
    default: false
  },
  
  // Có khóa thành tựu không
  locked: {
    type: Boolean,
    default: false
  },
  
  // Trạng thái hiển thị
  status: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Thứ tự hiển thị
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo index cho các trường tìm kiếm phổ biến
achievementSchema.index({ category: 1, status: 1 });
achievementSchema.index({ rarity: 1, status: 1 });
achievementSchema.index({ 'requirement.type': 1 });

module.exports = achievementSchema;
