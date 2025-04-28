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
  customer_id: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
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
bookmarkSchema.index({ customer_id: 1, story_id: 1 }, { unique: true });
bookmarkSchema.index({ customer_id: 1, createdAt: -1 });

// Virtuals
bookmarkSchema.virtual('story', {
  ref: 'Story',
  localField: 'story_id',
  foreignField: '_id',
  justOne: true
});

bookmarkSchema.virtual('chapter', {
  ref: 'Chapter',
  localField: 'chapter_id',
  foreignField: '_id',
  justOne: true
});

bookmarkSchema.virtual('customer', {
  ref: 'Customer',
  localField: 'customer_id',
  foreignField: '_id',
  justOne: true
});

// Phương thức tĩnh để tìm bookmark theo customer_id và story_id
bookmarkSchema.statics.findByCustomerAndStory = function(customerId, storyId) {
  return this.findOne({
    customer_id: customerId,
    story_id: storyId
  });
};

// Phương thức tĩnh để lấy danh sách bookmark của người dùng
bookmarkSchema.statics.findByCustomer = function(customerId, limit = 10, skip = 0) {
  return this.find({
    customer_id: customerId
  })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('story', 'name slug image')
    .populate('chapter', 'name chapter');
};

// Phương thức tĩnh để cập nhật hoặc tạo mới bookmark
bookmarkSchema.statics.upsertBookmark = async function(customerId, storyId, chapterId, note = '') {
  return this.findOneAndUpdate(
    { customer_id: customerId, story_id: storyId },
    {
      chapter_id: chapterId,
      note: note,
      $setOnInsert: { customer_id: customerId, story_id: storyId }
    },
    {
      new: true,
      upsert: true
    }
  );
};

module.exports = mongoose.model('Bookmark', bookmarkSchema);