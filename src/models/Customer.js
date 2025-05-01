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

// Phương thức thêm xu
customerSchema.methods.addCoins = async function(amount, options = {}) {
  if (amount <= 0) {
    throw new Error('Số xu thêm phải lớn hơn 0');
  }

  // Cập nhật số xu hiện tại và tổng xu
  this.coin += amount;
  this.coin_total += amount;

  // Lưu thông tin giao dịch nếu cần
  if (options.saveTransaction !== false) {
    const Transaction = mongoose.model('Transaction');
    await Transaction.createTransaction({
      customer_id: this._id,
      amount: amount,
      description: options.description || 'Thêm xu',
      type: options.type || 'admin',
      coin_change: amount,
      reference_type: options.reference_type || '',
      reference_id: options.reference_id || null,
      metadata: options.metadata || {
        admin_id: options.admin_id || null,
        admin_name: options.admin_name || null,
        note: options.note || ''
      }
    });
  }

  await this.save();
  return this.coin;
};

// Phương thức trừ xu
customerSchema.methods.subtractCoins = async function(amount, options = {}) {
  if (amount <= 0) {
    throw new Error('Số xu trừ phải lớn hơn 0');
  }

  if (this.coin < amount) {
    throw new Error('Số xu không đủ');
  }

  // Cập nhật số xu hiện tại và số xu đã tiêu
  this.coin -= amount;
  this.coin_spent += amount;

  // Lưu thông tin giao dịch nếu cần
  if (options.saveTransaction !== false) {
    const Transaction = mongoose.model('Transaction');
    await Transaction.createTransaction({
      customer_id: this._id,
      amount: amount,
      description: options.description || 'Trừ xu',
      type: options.type || 'admin',
      coin_change: -amount,
      reference_type: options.reference_type || '',
      reference_id: options.reference_id || null,
      metadata: options.metadata || {
        admin_id: options.admin_id || null,
        admin_name: options.admin_name || null,
        note: options.note || ''
      }
    });
  }

  await this.save();
  return this.coin;
};

// Phương thức cập nhật số xu
customerSchema.methods.updateCoins = async function(newAmount, options = {}) {
  if (newAmount < 0) {
    throw new Error('Số xu không thể âm');
  }

  const oldAmount = this.coin;
  const difference = newAmount - oldAmount;

  // Cập nhật số xu
  this.coin = newAmount;

  // Cập nhật tổng xu hoặc số xu đã tiêu tùy thuộc vào việc tăng hay giảm
  if (difference > 0) {
    this.coin_total += difference;
  } else if (difference < 0) {
    this.coin_spent += Math.abs(difference);
  }

  // Lưu thông tin giao dịch nếu cần
  if (options.saveTransaction !== false && difference !== 0) {
    const Transaction = mongoose.model('Transaction');
    await Transaction.createTransaction({
      customer_id: this._id,
      amount: Math.abs(difference),
      description: options.description || 'Cập nhật xu',
      type: options.type || 'admin',
      coin_change: difference,
      reference_type: options.reference_type || '',
      reference_id: options.reference_id || null,
      metadata: options.metadata || {
        admin_id: options.admin_id || null,
        admin_name: options.admin_name || null,
        note: options.note || '',
        old_amount: oldAmount,
        new_amount: newAmount
      }
    });
  }

  await this.save();
  return this.coin;
};

// Phương thức cập nhật thống kê xu
customerSchema.methods.updateCoinStats = async function() {
  const Transaction = mongoose.model('Transaction');
  const now = new Date();

  // Tính thống kê theo ngày
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const dailyTransactions = await Transaction.find({
    customer_id: this._id,
    transaction_date: { $gte: oneDayAgo },
    type: { $in: ['purchase', 'reward', 'admin'] }
  });

  const dailyTotal = dailyTransactions.reduce((sum, tx) =>
    sum + Math.abs(tx.coin_change), 0);

  // Tính thống kê theo tuần
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const weeklyTransactions = await Transaction.find({
    customer_id: this._id,
    transaction_date: { $gte: oneWeekAgo },
    type: { $in: ['purchase', 'reward', 'admin'] }
  });

  const weeklyTotal = weeklyTransactions.reduce((sum, tx) =>
    sum + Math.abs(tx.coin_change), 0);

  // Tính thống kê theo tháng
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const monthlyTransactions = await Transaction.find({
    customer_id: this._id,
    transaction_date: { $gte: oneMonthAgo },
    type: { $in: ['purchase', 'reward', 'admin'] }
  });

  const monthlyTotal = monthlyTransactions.reduce((sum, tx) =>
    sum + Math.abs(tx.coin_change), 0);

  // Cập nhật thống kê
  this.coin_stats = {
    daily_average: dailyTotal,
    weekly_average: Math.round(weeklyTotal / 7),
    monthly_average: Math.round(monthlyTotal / 30),
    last_updated: now
  };

  await this.save();
  return this.coin_stats;
};

module.exports = mongoose.model('Customer', customerSchema);