const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho bình luận
 * Hỗ trợ bình luận đa cấp và tối ưu cho truy vấn
 */
const commentSchema = new Schema({
  // ID của người dùng bình luận
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ID của truyện/chương được bình luận
  story_id: {
    type: Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
    index: true
  },

  // ID của chương nếu bình luận ở cấp chương
  chapter_id: {
    type: Schema.Types.ObjectId,
    ref: 'Chapter',
    index: true
  },

  // ID của bình luận cha nếu là bình luận con
  parent_id: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    index: true
  },

  // Nội dung bình luận
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },

  // Số lượt thích
  likes: {
    type: Number,
    default: 0,
    min: 0
  },

  // Danh sách ID người dùng đã thích (để tránh like nhiều lần)
  liked_by: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Số bình luận con
  reply_count: {
    type: Number,
    default: 0,
    min: 0
  },

  // Trạng thái bình luận
  status: {
    type: String,
    enum: ['active', 'hidden', 'deleted'],
    default: 'active',
    index: true
  },

  // Thông tin bổ sung
  metadata: {
    // Loại bình luận: 'story' - bình luận truyện, 'chapter' - bình luận chương
    type: {
      type: String,
      enum: ['story', 'chapter'],
      required: true
    },
    // Vị trí trong chương nếu là bình luận chương
    position: {
      type: Number,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index để tìm kiếm nhanh
commentSchema.index({ story_id: 1, chapter_id: 1, parent_id: 1 });
commentSchema.index({ user_id: 1 });
commentSchema.index({ 'metadata.type': 1, 'metadata.position': 1 });

module.exports = commentSchema;
