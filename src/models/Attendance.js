const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho điểm danh hàng ngày
 * Lưu lịch sử điểm danh của người dùng
 */
const attendanceSchema = new Schema({
  // ID của người dùng
  customer_id: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },

  // Ngày điểm danh (lưu ngày không có giờ phút giây)
  date: {
    type: Date,
    required: true
  },

  // Trạng thái điểm danh: 'attended' - đã điểm danh, 'missed' - bỏ lỡ
  status: {
    type: String,
    enum: ['attended', 'missed'],
    default: 'attended',
    index: true
  },

  // Số xu nhận được khi điểm danh
  reward: {
    type: Number,
    default: 10,
    min: 0
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

  // Thông tin bổ sung
  streak_count: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Số ngày điểm danh liên tiếp tại thời điểm điểm danh'
  },

  bonus_reward: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Phần thưởng bổ sung cho các mốc đặc biệt'
  },

  notes: {
    type: String,
    default: '',
    description: 'Ghi chú bổ sung về lần điểm danh này'
  },

  // Thông tin múi giờ của người dùng
  timezone: {
    type: String,
    default: 'Asia/Ho_Chi_Minh',
    description: 'Múi giờ của người dùng khi điểm danh (ví dụ: Asia/Ho_Chi_Minh, America/New_York)'
  },

  timezone_offset: {
    type: Number,
    default: 420, // 420 phút = GMT+7
    description: 'Độ lệch múi giờ so với UTC tính bằng phút'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index để tìm kiếm nhanh theo customer_id và date
attendanceSchema.index({ customer_id: 1, date: 1 }, { unique: true });

// Index để tìm kiếm nhanh theo customer_id, year và month
attendanceSchema.index({ customer_id: 1, year: 1, month: 1 });

// Index để tìm kiếm nhanh theo ngày
attendanceSchema.index({ date: 1 });

// Index để tìm kiếm nhanh theo status
attendanceSchema.index({ status: 1 });

// Virtuals
attendanceSchema.virtual('customer', {
  ref: 'Customer',
  localField: 'customer_id',
  foreignField: '_id',
  justOne: true
});

// Phương thức tĩnh để tính toán phần thưởng dựa trên số ngày liên tiếp
attendanceSchema.statics.calculateReward = function(streakCount) {
  let reward = 10; // Phần thưởng cơ bản

  // Thưởng thêm cho các mốc đặc biệt
  if (streakCount === 7) {
    reward += 100;
  } else if (streakCount === 15) {
    reward += 250;
  } else if (streakCount === 30) {
    reward += 1000;
  } else if (streakCount % 30 === 0 && streakCount > 30) {
    reward += 1000; // Thưởng thêm cho mỗi 30 ngày
  }

  return reward;
};

// Phương thức tĩnh để tạo bản ghi điểm danh mới
attendanceSchema.statics.createAttendance = async function(customerId, date, streakCount) {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  // Tính toán phần thưởng
  const baseReward = 10;
  let bonusReward = 0;

  // Thưởng thêm cho các mốc đặc biệt
  if (streakCount === 7) {
    bonusReward = 100;
  } else if (streakCount === 15) {
    bonusReward = 250;
  } else if (streakCount === 30) {
    bonusReward = 1000;
  } else if (streakCount % 30 === 0 && streakCount > 30) {
    bonusReward = 1000; // Thưởng thêm cho mỗi 30 ngày
  }

  // Tạo ghi chú
  let notes = '';
  if (bonusReward > 0) {
    notes = `Điểm danh ${streakCount} ngày liên tiếp! Thưởng thêm ${bonusReward} xu.`;
  }

  // Tạo bản ghi mới
  return this.create({
    customer_id: customerId,
    date,
    status: 'attended',
    reward: baseReward + bonusReward,
    day,
    month,
    year,
    streak_count: streakCount,
    bonus_reward: bonusReward,
    notes
  });
};

// Phương thức tĩnh để tạo bản ghi missed
attendanceSchema.statics.createMissedAttendance = async function(customerId, date) {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  return this.create({
    customer_id: customerId,
    date,
    status: 'missed',
    reward: 0,
    day,
    month,
    year,
    streak_count: 0,
    bonus_reward: 0,
    notes: 'Bỏ lỡ điểm danh'
  });
};

module.exports = mongoose.model('Attendance', attendanceSchema);
