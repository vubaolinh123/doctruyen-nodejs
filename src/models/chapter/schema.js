const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho chapter
 * Lưu thông tin các chapter của truyện
 */
const chapterSchema = new Schema({
  // Tham chiếu đến kho truyện chapter (nếu có)
  kho_truyen_chapter_id: {
    type: Number,
    default: 0
  },

  // Tham chiếu đến truyện
  story_id: {
    type: Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
    index: true
  },

  // Thông tin cơ bản
  chapter: {
    type: Number,
    required: true,
    min: 0
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  slug: {
    type: String
  },

  // Nội dung chapter
  content: {
    type: String,
    default: ''
  },

  // Thông tin audio
  audio: {
    type: String,
    default: ''
  },

  audio_show: {
    type: Boolean,
    default: false
  },

  // Hiển thị quảng cáo
  show_ads: {
    type: Boolean,
    default: false
  },

  // Link tham khảo
  link_ref: {
    type: String,
    default: ''
  },

  // Mã truy cập nếu có
  pass_code: {
    type: String,
    default: ''
  },

  // Thông tin chapter mới
  is_new: {
    type: Boolean,
    default: false
  },

  // Trạng thái hiển thị (changed to string to match story model)
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },

  // Trạng thái phê duyệt (approval system)
  approval_status: {
    type: String,
    enum: ['not_submitted', 'pending', 'approved', 'rejected'],
    default: 'not_submitted',
    index: true
  },

  // Metadata cho hệ thống phê duyệt
  approval_metadata: {
    // Thông tin từ chối
    rejection_reason: {
      type: String,
      default: ''
    },
    rejected_at: {
      type: Date
    },
    rejected_by: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    // Thông tin phê duyệt
    approved_at: {
      type: Date
    },
    approved_by: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    // Theo dõi số lần nộp
    submission_count: {
      type: Number,
      default: 0
    },
    last_submitted_at: {
      type: Date
    },
    current_note: {
      type: String,
      default: ''
    },

    // Lịch sử nộp lại
    resubmission_history: [{
      submission_count: {
        type: Number,
        required: true
      },
      submitted_at: {
        type: Date,
        required: true
      },
      note: {
        type: String,
        default: ''
      },
      previous_status: {
        type: String,
        required: true
      }
    }],

    // Ghi chú của admin
    admin_comments: {
      type: String,
      default: ''
    }
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

  // Lượt xem chapter
  views: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      if (ret.createdAt) {
        // Convert createdAt to Vietnam timezone (UTC+7)
        const createdAtVN = new Date(ret.createdAt);
        createdAtVN.setHours(createdAtVN.getHours() + 7);
        ret.createdAt = createdAtVN;
      }
      if (ret.updatedAt) {
        // Convert updatedAt to Vietnam timezone (UTC+7)
        const updatedAtVN = new Date(ret.updatedAt);
        updatedAtVN.setHours(updatedAtVN.getHours() + 7);
        ret.updatedAt = updatedAtVN;
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
chapterSchema.index({ story_id: 1, chapter: 1 });
chapterSchema.index({ story_id: 1, createdAt: -1 });
chapterSchema.index({ createdAt: -1 });

module.exports = chapterSchema;
