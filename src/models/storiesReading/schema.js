const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho lịch sử đọc truyện
 * Tối ưu hóa để tránh duplicate records và hỗ trợ bookmark system hiệu quả
 */
const storiesReadingSchema = new Schema({
  // Tham chiếu đến người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Tham chiếu đến truyện
  story_id: {
    type: Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
    index: true
  },

  // Thông tin chapter hiện tại đang đọc
  current_chapter: {
    chapter_id: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true
    },
    chapter_number: {
      type: Number,
      required: true
    }
    // Đã loại bỏ reading_position để tối ưu hóa tracking system
    // Hệ thống mới chỉ theo dõi chapter hiện tại và trạng thái hoàn thành
  },

  // Chapter cuối cùng đã đọc hoàn thành
  last_completed_chapter: {
    chapter_id: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter'
    },
    chapter_number: {
      type: Number
    },
    completed_at: {
      type: Date
    }
  },

  // Trạng thái đọc
  reading_status: {
    type: String,
    enum: ['reading', 'completed', 'paused', 'dropped', 'plan_to_read'],
    default: 'reading',
    index: true
  },

  // Thống kê đọc
  reading_stats: {
    // Tổng thời gian đọc (giây) - đã cập nhật từ phút sang giây để tracking chính xác hơn
    total_reading_time: {
      type: Number,
      default: 0,
      min: 0
    },
    // Số lần truy cập
    visit_count: {
      type: Number,
      default: 1,
      min: 1
    },
    // Số chapter đã đọc hoàn thành
    completed_chapters: {
      type: Number,
      default: 0,
      min: 0
    },
    // Lần đọc đầu tiên
    first_read_at: {
      type: Date,
      default: Date.now
    },
    // Lần đọc gần nhất
    last_read_at: {
      type: Date,
      default: Date.now
    }
  },

  // Hệ thống bookmark tối ưu (tối đa 10 bookmarks mỗi story)
  bookmarks: [{
    chapter_id: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true
    },
    chapter_number: {
      type: Number,
      required: true
    },
    position: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    note: {
      type: String,
      maxlength: 200,
      trim: true
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  }],

  // Ghi chú cá nhân về truyện
  personal_notes: {
    type: String,
    maxlength: 1000,
    trim: true
  },

  // Metadata bổ sung
  metadata: {
    // Có được thông báo khi có chapter mới không
    notification_enabled: {
      type: Boolean,
      default: false
    },
    // Tags cá nhân
    personal_tags: [{
      type: String,
      trim: true,
      maxlength: 50
    }],
    // Độ ưu tiên đọc (1-5)
    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
storiesReadingSchema.index({ user_id: 1, story_id: 1 }, { unique: true });
storiesReadingSchema.index({ user_id: 1, updatedAt: -1 });
storiesReadingSchema.index({ user_id: 1, reading_status: 1 });
storiesReadingSchema.index({ user_id: 1, 'reading_stats.last_read_at': -1 });
storiesReadingSchema.index({ 'current_chapter.chapter_id': 1 });

// Middleware để giới hạn số lượng bookmarks
storiesReadingSchema.pre('save', function(next) {
  // Giới hạn tối đa 10 bookmarks
  if (this.bookmarks && this.bookmarks.length > 10) {
    // Giữ lại 10 bookmarks mới nhất
    this.bookmarks = this.bookmarks
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);
  }

  // Cập nhật last_read_at khi có thay đổi
  if (this.isModified('current_chapter') || this.isModified('reading_stats.total_reading_time')) {
    this.reading_stats.last_read_at = new Date();
  }

  next();
});

module.exports = storiesReadingSchema;