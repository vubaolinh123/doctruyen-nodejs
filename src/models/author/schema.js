const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho tác giả
 * Lưu thông tin các tác giả của truyện
 * Hỗ trợ hai loại tác giả:
 * - External: Tác giả bên ngoài (không có tài khoản trong hệ thống)
 * - System: Người dùng đã đăng ký trở thành tác giả
 */
const authorSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  slug: {
    type: String
  },

  // Loại tác giả: external (tác giả bên ngoài) hoặc system (người dùng trong hệ thống)
  authorType: {
    type: String,
    enum: ['external', 'system'],
    default: 'external',
    required: true,
    index: true
  },

  // ID của người dùng (chỉ áp dụng cho authorType = 'system')
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
    validate: {
      validator: function(value) {
        // Nếu authorType là 'system', userId phải có giá trị
        if (this.authorType === 'system') {
          return value != null;
        }
        // Nếu authorType là 'external', userId phải là null
        if (this.authorType === 'external') {
          return value == null;
        }
        return true;
      },
      message: 'userId phải có giá trị khi authorType là "system" và phải là null khi authorType là "external"'
    }
  },

  status: {
    type: Boolean,
    default: true
  },

  // Approval workflow fields
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },

  approvalDate: {
    type: Date,
    default: null
  },

  rejectionReason: {
    type: String,
    default: null,
    trim: true
  },

  // Admin who approved/rejected the application
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // Convert timestamps to Vietnam timezone without Z suffix
      if (ret.createdAt) {
        const createdAtVN = new Date(ret.createdAt);
        createdAtVN.setHours(createdAtVN.getHours() + 7);
        ret.createdAt = createdAtVN.toISOString().replace('Z', '');
      }
      if (ret.updatedAt) {
        const updatedAtVN = new Date(ret.updatedAt);
        updatedAtVN.setHours(updatedAtVN.getHours() + 7);
        ret.updatedAt = updatedAtVN.toISOString().replace('Z', '');
      }
      if (ret.approvalDate) {
        const approvalDateVN = new Date(ret.approvalDate);
        approvalDateVN.setHours(approvalDateVN.getHours() + 7);
        ret.approvalDate = approvalDateVN.toISOString().replace('Z', '');
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Tạo index cho các trường tìm kiếm phổ biến
authorSchema.index({ name: 1 });
authorSchema.index({ createdAt: -1 });
authorSchema.index({ authorType: 1, status: 1 });
authorSchema.index({ userId: 1 }, { sparse: true }); // Sparse index vì userId có thể null

// Compound index để đảm bảo một user chỉ có thể có một author record
authorSchema.index({ userId: 1, authorType: 1 }, {
  unique: true,
  sparse: true,
  partialFilterExpression: {
    authorType: 'system',
    userId: { $ne: null }
  }
});

// Virtual fields để map populated data
authorSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

authorSchema.virtual('reviewer', {
  ref: 'User',
  localField: 'reviewedBy',
  foreignField: '_id',
  justOne: true
});

module.exports = authorSchema;
