const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho điểm danh hàng ngày
 * Lưu lịch sử điểm danh của người dùng
 */
const attendanceSchema = new Schema({
  // ID của người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
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
  },

  // Thêm trường để lưu thời gian điểm danh chính xác
  attendance_time: {
    type: Date,
    default: Date.now,
    description: 'Thời gian chính xác khi người dùng điểm danh'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index để tìm kiếm nhanh theo user_id và date
attendanceSchema.index({ user_id: 1, date: 1 }, { unique: true });

// Index để tìm kiếm nhanh theo user_id, year và month
attendanceSchema.index({ user_id: 1, year: 1, month: 1 });

// Index để tìm kiếm nhanh theo ngày
attendanceSchema.index({ date: 1 });

module.exports = attendanceSchema;
