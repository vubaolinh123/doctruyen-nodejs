const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho quyền hạn của người dùng
 * Lưu thông tin về các quyền đặc biệt mà người dùng được cấp
 */
const userPermissionSchema = new Schema({
  // ID của người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ID của permission template (reference)
  template_id: {
    type: Schema.Types.ObjectId,
    ref: 'PermissionTemplate',
    required: true,
    index: true
  },

  // Tên quyền (lấy từ template)
  name: {
    type: String,
    required: true,
    index: true
  },

  // Mô tả cụ thể cho permission của user này (có thể override từ template)
  description: {
    type: String,
    default: ''
  },

  // Loại quyền
  type: {
    type: String,
    enum: ['feature', 'appearance', 'content', 'interaction', 'other'],
    default: 'other',
    index: true
  },

  // Giá trị của quyền (có thể là boolean, số, chuỗi, hoặc đối tượng)
  value: {
    type: Schema.Types.Mixed,
    default: true
  },

  // Nguồn gốc của quyền
  source: {
    type: String,
    enum: ['achievement', 'level', 'purchase', 'admin', 'other'],
    default: 'admin',
    index: true
  },

  // ID tham chiếu (nếu quyền đến từ thành tựu, cấp độ, v.v.)
  reference_id: {
    type: Schema.Types.ObjectId,
    default: null
  },

  // Thời gian hết hạn (null = vĩnh viễn)
  expires_at: {
    type: Date,
    default: null,
    index: true
  },

  // Trạng thái kích hoạt
  active: {
    type: Boolean,
    default: true,
    index: true
  },

  // Thời gian cấp quyền
  granted_at: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Thông tin bổ sung
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
userPermissionSchema.index({ user_id: 1, template_id: 1 }, { unique: true });
userPermissionSchema.index({ user_id: 1, name: 1 });
userPermissionSchema.index({ user_id: 1, active: 1, expires_at: 1 });
userPermissionSchema.index({ template_id: 1 });
userPermissionSchema.index({ source: 1, reference_id: 1 });

module.exports = userPermissionSchema;
