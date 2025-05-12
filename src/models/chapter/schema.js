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

  // Trạng thái hiển thị
  status: {
    type: Boolean,
    default: false,
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
