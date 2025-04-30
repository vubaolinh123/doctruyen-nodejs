const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho người dùng
 * Lưu thông tin cơ bản của người dùng
 */
const customerSchema = new Schema({
  // Thông tin cá nhân
  name: {
    type: String,
    required: true,
    trim: true
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
    enum: ['email', 'google', 'facebook'],
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
  tu_vi: {
    type: String,
    default: ''
  },
  tu_bao_cac: {
    type: String,
    default: ''
  },

  // Trường tương thích ngược - sẽ loại bỏ trong tương lai
  diem_danh: {
    type: Number,
    default: 0
  },
  check_in_date: Date,
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
customerSchema.index({ email: 1 });
customerSchema.index({ role: 1, status: 1 });
customerSchema.index({ 'attendance_summary.last_attendance': 1 });

// Virtuals
customerSchema.virtual('bookmarks', {
  ref: 'Bookmark',
  localField: '_id',
  foreignField: 'customer_id'
});

customerSchema.virtual('purchased_stories', {
  ref: 'PurchasedStory',
  localField: '_id',
  foreignField: 'customer_id'
});

customerSchema.virtual('reading_history', {
  ref: 'StoriesReading',
  localField: '_id',
  foreignField: 'customer_id'
});

customerSchema.virtual('transactions', {
  ref: 'Transaction',
  localField: '_id',
  foreignField: 'customer_id'
});

customerSchema.virtual('attendance', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'customer_id'
});

customerSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'customer_id'
});

customerSchema.virtual('liked_comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'liked_by'
});

// Phương thức kiểm tra role
customerSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

customerSchema.methods.isAuthor = function() {
  return this.role === 'author';
};

// Phương thức cập nhật thông tin điểm danh
customerSchema.methods.updateAttendance = async function(date) {
  const lastDate = this.attendance_summary.last_attendance;

  // Nếu đã điểm danh hôm nay
  if (lastDate && lastDate.toDateString() === date.toDateString()) {
    return false;
  }

  // Cập nhật thông tin điểm danh
  this.attendance_summary.total_days++;
  this.attendance_summary.last_attendance = date;

  // Cập nhật streak
  if (lastDate) {
    const diffDays = Math.floor((date - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      this.attendance_summary.current_streak++;
    } else {
      this.attendance_summary.current_streak = 1;
    }
  } else {
    this.attendance_summary.current_streak = 1;
  }

  // Cập nhật longest streak
  if (this.attendance_summary.current_streak > this.attendance_summary.longest_streak) {
    this.attendance_summary.longest_streak = this.attendance_summary.current_streak;
  }

  await this.save();
  return true;
};

// Phương thức cập nhật số lượng bình luận
customerSchema.methods.updateCommentCount = async function(increment = 1) {
  this.metadata.comment_count += increment;
  await this.save();
};

// Phương thức cập nhật số lượng bình luận đã like
customerSchema.methods.updateLikedCommentsCount = async function(increment = 1) {
  this.metadata.liked_comments_count += increment;
  await this.save();
};

module.exports = mongoose.model('Customer', customerSchema);