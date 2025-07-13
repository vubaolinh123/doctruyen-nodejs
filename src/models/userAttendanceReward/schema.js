const mongoose = require('mongoose');

/**
 * UserAttendanceMilestone Schema
 * Lưu trữ thông tin mốc điểm danh mà user đã đạt được
 * - monthly: Mốc theo tháng (có thể đạt lại mỗi tháng)
 * - lifetime: Mốc theo tổng số ngày (chỉ đạt một lần)
 */
const userAttendanceMilestoneSchema = new mongoose.Schema({
  // ID user nhận thưởng
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ID mốc phần thưởng
  milestone_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceMilestone',
    required: true,
    index: true
  },

  // Thời gian nhận thưởng
  claimed_at: {
    type: Date,
    default: Date.now,
    required: true
  },

  // Tháng nhận thưởng (chỉ cho monthly milestones)
  month: {
    type: Number,
    min: 0,
    max: 11,
    required: function() {
      // Chỉ required cho monthly milestones
      return this.milestone_type === 'monthly';
    },
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

  // Loại mốc (snapshot để tránh thay đổi sau này)
  milestone_type: {
    type: String,
    enum: ['monthly', 'lifetime'],
    required: true,
    index: true
  },

  // Số ngày điểm danh tại thời điểm nhận thưởng
  days_at_claim: {
    type: Number,
    min: 0,
    required: true,
    description: 'Số ngày điểm danh trong tháng (monthly) hoặc tổng số ngày (lifetime) tại thời điểm nhận thưởng'
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
  collection: 'user_attendance_milestones'
});

// Compound indexes
// Index cho user và milestone - unique cho lifetime, không unique cho monthly (có thể nhận lại mỗi tháng)
userAttendanceMilestoneSchema.index({
  user_id: 1,
  milestone_id: 1,
  milestone_type: 1,
  month: 1,
  year: 1
});

// Index cho query performance
userAttendanceMilestoneSchema.index({ user_id: 1, claimed_at: -1 });
userAttendanceMilestoneSchema.index({ milestone_id: 1, claimed_at: -1 });
userAttendanceMilestoneSchema.index({ user_id: 1, year: 1, month: 1 });
userAttendanceMilestoneSchema.index({ user_id: 1, milestone_type: 1 });
userAttendanceMilestoneSchema.index({ claimed_at: -1 });

module.exports = userAttendanceMilestoneSchema;
