const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho lịch sử đọc truyện
 * Lưu thông tin lịch sử đọc truyện của người dùng
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

  // Chapter đang đọc (chapter hiện tại)
  chapter_id_reading: {
    type: Schema.Types.ObjectId,
    ref: 'Chapter',
    required: true
  },

  // Chapter đã đọc (chapter cuối cùng đã đọc xong)
  chapter_id_read: {
    type: Schema.Types.ObjectId,
    ref: 'Chapter'
  },

  // Vị trí đọc trong chapter (phần trăm)
  reading_position: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Thời gian đọc (phút)
  reading_time: {
    type: Number,
    default: 0,
    min: 0
  },

  // Số lần đọc
  read_count: {
    type: Number,
    default: 1,
    min: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
storiesReadingSchema.index({ user_id: 1, story_id: 1 }, { unique: true });
storiesReadingSchema.index({ user_id: 1, updatedAt: -1 });

module.exports = storiesReadingSchema; 