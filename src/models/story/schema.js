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

  status: {
    type: Boolean,
    default: true,
    index: true
  },

  // Thêm trường chapter_count để lưu trữ số lượng chapter
  // Trường này sẽ được cập nhật khi thêm/xóa chapter
  chapter_count: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  collection: 'stories'
});

// Tạo các index để tối ưu truy vấn
storySchema.index({ name: 'text', desc: 'text', slug: 'text' });
storySchema.index({ createdAt: -1 });
storySchema.index({ updatedAt: -1 });

module.exports = storySchema;
