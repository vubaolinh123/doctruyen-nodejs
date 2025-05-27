const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho Permission Template
 * Lưu trữ danh sách các permissions có sẵn trong hệ thống
 */
const permissionTemplateSchema = new Schema({
  // Tên permission (unique)
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },

  // Tên hiển thị
  display_name: {
    type: String,
    required: true,
    trim: true
  },

  // Mô tả chi tiết tác dụng của permission
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },

  // Loại permission
  type: {
    type: String,
    enum: ['feature', 'appearance', 'content', 'interaction', 'system', 'other'],
    default: 'other',
    index: true
  },

  // Danh mục permission (để nhóm các permissions liên quan)
  category: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // Giá trị mặc định của permission
  default_value: {
    type: Schema.Types.Mixed,
    default: true
  },

  // Loại giá trị (để validation và UI)
  value_type: {
    type: String,
    enum: ['boolean', 'number', 'string', 'object', 'array'],
    default: 'boolean'
  },

  // Cấu hình cho giá trị (ví dụ: min/max cho number, options cho select)
  value_config: {
    type: Schema.Types.Mixed,
    default: {}
  },

  // Trạng thái kích hoạt
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },

  // Có thể hết hạn không
  can_expire: {
    type: Boolean,
    default: false
  },

  // Thời gian hết hạn mặc định (tính bằng ngày, null = vĩnh viễn)
  default_expiry_days: {
    type: Number,
    default: null,
    min: 1
  },

  // Mức độ ưu tiên (để sắp xếp)
  priority: {
    type: Number,
    default: 0,
    index: true
  },

  // Permissions phụ thuộc (cần có trước khi gán permission này)
  dependencies: [{
    type: String,
    trim: true
  }],

  // Permissions xung đột (không thể cùng tồn tại)
  conflicts: [{
    type: String,
    trim: true
  }],

  // Người tạo
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Người cập nhật cuối
  updated_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Tags để tìm kiếm
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  // Metadata bổ sung
  metadata: {
    // Icon cho UI
    icon: {
      type: String,
      default: ''
    },
    // Màu sắc cho UI
    color: {
      type: String,
      default: '#6B7280'
    },
    // Ghi chú nội bộ
    internal_notes: {
      type: String,
      default: ''
    },
    // Version của permission template
    version: {
      type: String,
      default: '1.0.0'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
permissionTemplateSchema.index({ name: 1, is_active: 1 });
permissionTemplateSchema.index({ category: 1, type: 1 });
permissionTemplateSchema.index({ priority: -1, name: 1 });
permissionTemplateSchema.index({ tags: 1 });

// Text index cho tìm kiếm
permissionTemplateSchema.index({
  name: 'text',
  display_name: 'text',
  description: 'text',
  category: 'text',
  tags: 'text'
});

module.exports = permissionTemplateSchema;
