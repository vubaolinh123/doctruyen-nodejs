const mongoose = require('mongoose');

/**
 * AttendanceMilestone Schema
 * Định nghĩa các mốc phần thưởng điểm danh mới
 * - monthly: Mốc theo tháng (reset hàng tháng)
 * - lifetime: Mốc theo tổng số ngày (không reset)
 */
const attendanceMilestoneSchema = new mongoose.Schema({
  // Loại mốc: 'monthly' (theo tháng) hoặc 'lifetime' (theo tổng số ngày)
  type: {
    type: String,
    enum: ['monthly', 'lifetime'],
    required: true,
    index: true
  },

  // Số ngày yêu cầu để đạt mốc
  required_days: {
    type: Number,
    required: true,
    min: 1,
    index: true
  },

  // Loại phần thưởng: 'coin' hoặc 'permission'
  reward_type: {
    type: String,
    enum: ['coin', 'permission'],
    required: true
  },

  // Giá trị xu (nếu reward_type là 'coin')
  reward_value: {
    type: Number,
    min: 0,
    default: 0,
    validate: {
      validator: function(value) {
        // Nếu reward_type là 'coin' thì reward_value phải > 0
        if (this.reward_type === 'coin') {
          return value > 0;
        }
        return true;
      },
      message: 'Reward value must be greater than 0 when reward type is coin'
    }
  },

  // ID permission (nếu reward_type là 'permission')
  permission_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PermissionTemplate',
    validate: {
      validator: function(value) {
        // Nếu reward_type là 'permission' thì permission_id phải có giá trị
        if (this.reward_type === 'permission') {
          return value != null;
        }
        return true;
      },
      message: 'Permission ID is required when reward type is permission'
    }
  },

  // Tên mốc phần thưởng
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },

  // Mô tả phần thưởng
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },

  // Trạng thái hoạt động
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },

  // Thời gian tạo
  created_at: {
    type: Date,
    default: Date.now
  },

  // Thời gian cập nhật
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'attendance_milestones'
});

// Compound index để đảm bảo không có 2 mốc cùng type và required_days
attendanceMilestoneSchema.index({ type: 1, required_days: 1 }, { unique: true });

// Index cho query performance
attendanceMilestoneSchema.index({ is_active: 1, type: 1 });
attendanceMilestoneSchema.index({ required_days: 1 });

module.exports = attendanceMilestoneSchema;
