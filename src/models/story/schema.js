const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho truyện
 * Lưu thông tin cơ bản của truyện
 */
const storySchema = new Schema({
  // Thông tin cơ bản
  slug: {
    type: String,
    unique: true
  },

  image: {
    type: String,
    default: ''
  },

  banner: {
    type: String,
    default: ''
  },

  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  desc: {
    type: String,
    default: ''
  },

  // Tham chiếu đến tác giả
  author_id: [{
    type: Schema.Types.ObjectId,
    ref: 'Author',
    index: true
  }],

  // Thông tin thể loại
  categories: [{
    type: Schema.Types.ObjectId,
    ref: 'Category'
  }],



  // Thông tin trạng thái
  is_full: {
    type: Boolean,
    default: false
  },

  // Thông tin nổi bật
  is_hot: {
    type: Boolean,
    default: false,
    index: true
  },

  is_new: {
    type: Boolean,
    default: false
  },

  show_ads: {
    type: Boolean,
    default: false
  },

  hot_day: {
    type: Boolean,
    default: false
  },

  hot_week: {
    type: Boolean,
    default: false
  },

  hot_month: {
    type: Boolean,
    default: false
  },

  hot_all_time: {
    type: Boolean,
    default: false
  },

  // Story publication status
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
    index: true
  },

  // Story approval workflow
  approval_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },

  // Approval metadata
  approval_metadata: {
    approved_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approved_at: {
      type: Date,
      default: null
    },
    rejection_reason: {
      type: String,
      default: '',
      maxlength: 500
    },
    rejected_at: {
      type: Date,
      default: null
    },
    submission_count: {
      type: Number,
      default: 1,
      min: 1
    },
    last_submitted_at: {
      type: Date,
      default: Date.now
    }
  },

  // Thêm trường chapter_count để lưu trữ số lượng chapter
  // Trường này sẽ được cập nhật khi thêm/xóa chapter
  chapter_count: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },

  // Hệ thống nội dung trả phí
  isPaid: {
    type: Boolean,
    default: false,
    index: true
  },

  price: {
    type: Number,
    default: 0,
    min: 0
  },

  // FREEMIUM MODEL: Indicates if story has any paid chapters
  hasPaidChapters: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  collection: 'stories'
});

// Validation middleware for approval workflow
storySchema.pre('save', function(next) {
  // Stories can only be published if approved
  if (this.status === 'published' && this.approval_status !== 'approved') {
    return next(new Error('Truyện chỉ có thể được xuất bản khi đã được phê duyệt'));
  }

  // Update approval metadata timestamps
  if (this.isModified('approval_status')) {
    if (this.approval_status === 'approved') {
      this.approval_metadata.approved_at = new Date();
    } else if (this.approval_status === 'rejected') {
      this.approval_metadata.rejected_at = new Date();
    }
  }

  // Update submission count when resubmitting
  if (this.isModified('approval_status') && this.approval_status === 'pending' && !this.isNew) {
    this.approval_metadata.submission_count += 1;
    this.approval_metadata.last_submitted_at = new Date();
  }

  next();
});

// Tạo các index để tối ưu truy vấn
storySchema.index({ name: 'text', desc: 'text', slug: 'text' });
storySchema.index({ createdAt: -1 });
storySchema.index({ updatedAt: -1 });
storySchema.index({ approval_status: 1, status: 1 });
storySchema.index({ 'approval_metadata.approved_at': -1 });
storySchema.index({ 'approval_metadata.last_submitted_at': -1 });

module.exports = storySchema;
