const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho người dùng
 * Lưu thông tin cơ bản của người dùng
 */
const userSchema = new Schema({
  // Thông tin cá nhân
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  email_verified_at: Date,
  password: {
    type: String,
    required: [function () { return this.accountType !== 'google'; }, 'Password is required']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'other'
  },
  birthday: Date,
  avatar: {
    type: String,
    default: null
  },
  banner: {
    type: String,
    default: null
  },

  // Thông tin mạng xã hội và giới thiệu
  social: {
    bio: {
      type: String,
      default: '',
      maxlength: 200,
      trim: true
    },
    facebook: {
      type: String,
      default: '',
      trim: true
    },
    twitter: {
      type: String,
      default: '',
      trim: true
    },
    instagram: {
      type: String,
      default: '',
      trim: true
    },
    youtube: {
      type: String,
      default: '',
      trim: true
    },
    website: {
      type: String,
      default: '',
      trim: true
    }
  },

  // Thông tin tài khoản
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active'
  },
  role: {
    type: String,
    enum: ['user', 'author', 'admin'],
    default: 'user'
  },
  accountType: {
    type: String,
    enum: ['email', 'google'],
    default: 'email'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  last_active: Date,
  email_verified: {
    type: Boolean,
    default: false
  },

  // Thông tin xu và tiền
  coin: {
    type: Number,
    default: 0,
    min: 0
  },
  coin_total: {
    type: Number,
    default: 0,
    min: 0
  },
  coin_spent: {
    type: Number,
    default: 0,
    min: 0
  },
  coin_stats: {
    daily_average: {
      type: Number,
      default: 0
    },
    weekly_average: {
      type: Number,
      default: 0
    },
    monthly_average: {
      type: Number,
      default: 0
    },
    last_updated: {
      type: Date,
      default: Date.now
    }
  },

  // Thông tin điểm danh (đã được tối ưu)
  attendance_summary: {
    total_days: {
      type: Number,
      default: 0,
      min: 0
    },
    current_streak: {
      type: Number,
      default: 0,
      min: 0
    },
    longest_streak: {
      type: Number,
      default: 0,
      min: 0
    },
    last_attendance: {
      type: Date,
      default: null
    }
  },

  // Thông tin bổ sung
  metadata: {
    // Số lượng bình luận đã đăng
    comment_count: {
      type: Number,
      default: 0,
      min: 0
    },
    // Số lượng bình luận đã like
    liked_comments_count: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Thông tin múi giờ của người dùng
  timezone: {
    type: String,
    default: 'Asia/Ho_Chi_Minh',
    description: 'Múi giờ của người dùng (ví dụ: Asia/Ho_Chi_Minh, America/New_York)'
  },

  timezone_offset: {
    type: Number,
    default: 420, // 420 phút = GMT+7
    description: 'Độ lệch múi giờ so với UTC tính bằng phút'
  },



  // Các trường khác
  remember_token: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
userSchema.index({ role: 1, status: 1 });
userSchema.index({ 'attendance_summary.last_attendance': 1 });

module.exports = userSchema;