const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho điểm danh theo tháng
 * Lưu lịch sử điểm danh của người dùng theo tháng để giảm số lượng document
 */
const attendanceMonthlySchema = new Schema({
  // ID của người dùng
  customer_id: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },

  // Tháng và năm
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

  // Lưu các ngày đã điểm danh dưới dạng bitmap (31 bit)
  // Mỗi bit đại diện cho một ngày trong tháng (1 = đã điểm danh, 0 = chưa điểm danh)
  attendance_bitmap: {
    type: Number,
    default: 0
  },

  // Số ngày đã điểm danh trong tháng
  attended_days: {
    type: Number,
    default: 0,
    min: 0,
    max: 31
  },

  // Số ngày liên tiếp cuối cùng trong tháng
  last_streak: {
    type: Number,
    default: 0,
    min: 0
  },

  // Tổng số xu nhận được trong tháng
  total_reward: {
    type: Number,
    default: 0,
    min: 0
  },

  // Thông tin bổ sung
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index để tìm kiếm nhanh theo customer_id, year và month
attendanceMonthlySchema.index({ customer_id: 1, year: 1, month: 1 }, { unique: true });

// Virtuals
attendanceMonthlySchema.virtual('customer', {
  ref: 'Customer',
  localField: 'customer_id',
  foreignField: '_id',
  justOne: true
});

// Phương thức để kiểm tra đã điểm danh ngày nào chưa
attendanceMonthlySchema.methods.hasAttended = function(day) {
  return (this.attendance_bitmap & (1 << (day - 1))) !== 0;
};

// Phương thức để đánh dấu đã điểm danh
attendanceMonthlySchema.methods.markAttendance = function(day, streakCount) {
  if (!this.hasAttended(day)) {
    this.attendance_bitmap |= (1 << (day - 1));
    this.attended_days++;
    this.last_streak = streakCount;
    
    // Tính phần thưởng
    const baseReward = 10;
    let bonusReward = 0;

    if (streakCount === 7) {
      bonusReward = 100;
    } else if (streakCount === 15) {
      bonusReward = 250;
    } else if (streakCount === 30) {
      bonusReward = 1000;
    } else if (streakCount % 30 === 0 && streakCount > 30) {
      bonusReward = 1000;
    }

    this.total_reward += (baseReward + bonusReward);
    return true;
  }
  return false;
};

// Phương thức để lấy danh sách ngày đã điểm danh
attendanceMonthlySchema.methods.getAttendedDays = function() {
  const days = [];
  for (let i = 0; i < 31; i++) {
    if ((this.attendance_bitmap & (1 << i)) !== 0) {
      days.push(i + 1);
    }
  }
  return days;
};

module.exports = mongoose.model('AttendanceMonthly', attendanceMonthlySchema); 