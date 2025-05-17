const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho nhiệm vụ
 * Lưu thông tin các nhiệm vụ hàng ngày và hàng tuần
 */
const missionSchema = new Schema({
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
  
  // Loại nhiệm vụ: daily (hàng ngày) hoặc weekly (hàng tuần)
  type: {
    type: String,
    enum: ['daily', 'weekly'],
    required: true,
    index: true
  },
  
  // Độ hiếm của nhiệm vụ
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic'],
    default: 'common'
  },
  
  // Yêu cầu để hoàn thành nhiệm vụ
  requirement: {
    // Loại yêu cầu (đọc truyện, bình luận, điểm danh, v.v.)
    type: {
      type: String,
      enum: ['read_chapter', 'comment', 'attendance', 'view_story', 'rate_story', 'other'],
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
  
  // Phần thưởng khi hoàn thành
  reward: {
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
  
  // Nhiệm vụ con (nếu có)
  subMissions: [{
    title: {
      type: String,
      required: true
    },
    
    description: {
      type: String,
      default: ''
    },
    
    requirement: {
      type: {
        type: String,
        enum: ['read_chapter', 'comment', 'attendance', 'view_story', 'rate_story', 'other'],
        default: 'other'
      },
      
      count: {
        type: Number,
        default: 1,
        min: 1
      },
      
      conditions: {
        type: Object,
        default: {}
      }
    }
  }],
  
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
  },
  
  // Thời gian làm mới (reset)
  resetTime: {
    // Giờ làm mới (0-23)
    hour: {
      type: Number,
      default: 0,
      min: 0,
      max: 23
    },
    
    // Phút làm mới (0-59)
    minute: {
      type: Number,
      default: 0,
      min: 0,
      max: 59
    },
    
    // Ngày trong tuần làm mới (0: Chủ nhật, 1-6: Thứ 2 - Thứ 7)
    // Chỉ áp dụng cho nhiệm vụ hàng tuần
    dayOfWeek: {
      type: Number,
      default: 0,
      min: 0,
      max: 6
    }
  },
  
  // Thời gian tạo và cập nhật
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo index cho các trường tìm kiếm phổ biến
missionSchema.index({ type: 1, status: 1 });
missionSchema.index({ 'requirement.type': 1 });
missionSchema.index({ rarity: 1 });

module.exports = missionSchema;
