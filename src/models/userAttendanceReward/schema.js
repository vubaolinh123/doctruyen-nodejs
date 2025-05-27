const mongoose = require('mongoose');

/**
 * UserAttendanceReward Schema
 * Lưu trữ thông tin phần thưởng điểm danh mà user đã nhận
 */
const userAttendanceRewardSchema = new mongoose.Schema({
  // ID user nhận thưởng
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ID mốc phần thưởng
  reward_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceReward',
    required: true,
    index: true
  },

  // Thời gian nhận thưởng
  claimed_at: {
    type: Date,
    default: Date.now,
    required: true
  },

  // Tháng nhận thưởng (cho consecutive rewards - reset hàng tháng)
  month: {
    type: Number,
    min: 0,
    max: 11,
    required: true,
    index: true
  },

  // Năm nhận thưởng
  year: {
    type: Number,
    min: 2020,
    max: 2100,
    required: true,
    index: true
  },

  // Số ngày điểm danh tại thời điểm nhận thưởng (để tracking)
  consecutive_days_at_claim: {
    type: Number,
    min: 0,
    default: 0
  },

  // Tổng số ngày điểm danh tại thời điểm nhận thưởng (để tracking)
  total_days_at_claim: {
    type: Number,
    min: 0,
    default: 0
  },

  // Loại phần thưởng đã nhận (snapshot để tránh thay đổi sau này)
  reward_type: {
    type: String,
    enum: ['coin', 'permission'],
    required: true
  },

  // Giá trị phần thưởng đã nhận (snapshot)
  reward_value: {
    type: Number,
    min: 0,
    default: 0
  },

  // Permission ID đã nhận (snapshot)
  permission_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PermissionTemplate',
    default: null
  },

  // Ghi chú thêm
  notes: {
    type: String,
    maxlength: 500,
    default: ''
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'user_attendance_rewards'
});

// Compound indexes
// Index cho user và reward (không unique vì total rewards có thể nhận 1 lần, consecutive có thể nhận nhiều tháng)
userAttendanceRewardSchema.index({
  user_id: 1,
  reward_id: 1,
  month: 1,
  year: 1
});

// Index cho query performance
userAttendanceRewardSchema.index({ user_id: 1, claimed_at: -1 });
userAttendanceRewardSchema.index({ reward_id: 1, claimed_at: -1 });
userAttendanceRewardSchema.index({ user_id: 1, year: 1, month: 1 });
userAttendanceRewardSchema.index({ claimed_at: -1 });

module.exports = userAttendanceRewardSchema;
