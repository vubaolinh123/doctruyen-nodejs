const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho bookmark
 * Lưu thông tin đánh dấu truyện của người dùng
 */
const bookmarkSchema = new Schema({
  // Tham chiếu đến truyện
  story_id: {
    type: Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
    index: true
  },

  // Tham chiếu đến chapter
  chapter_id: {
    type: Schema.Types.ObjectId,
    ref: 'Chapter',
    required: true,
    index: true
  },

  // Tham chiếu đến người dùng
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Ghi chú của người dùng
  note: {
    type: String,
    default: ''
  },

  // Vị trí đọc (nếu có)
  position: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
bookmarkSchema.index({ user_id: 1, story_id: 1 }, { unique: true });
bookmarkSchema.index({ user_id: 1, createdAt: -1 });

module.exports = bookmarkSchema;
