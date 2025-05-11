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

bookmarkSchema.virtual('user', {
  ref: 'User',
  localField: 'user_id',
  foreignField: '_id',
  justOne: true
});

// Phương thức tĩnh để tìm bookmark theo user_id và story_id
bookmarkSchema.statics.findByCustomerAndStory = function(userId, storyId) {
  return this.findOne({
    user_id: userId,
    story_id: storyId
  });
};

// Phương thức tĩnh để lấy danh sách bookmark của người dùng
bookmarkSchema.statics.findByCustomer = function(userId, limit = 10, skip = 0) {
  return this.find({
    user_id: userId
  })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('story', 'name slug image')
    .populate('chapter', 'name chapter');
};

// Phương thức tĩnh để cập nhật hoặc tạo mới bookmark
bookmarkSchema.statics.upsertBookmark = async function(userId, storyId, chapterId, note = '') {
  return this.findOneAndUpdate(
    { user_id: userId, story_id: storyId },
    {
      chapter_id: chapterId,
      note: note,
      $setOnInsert: { user_id: userId, story_id: storyId }
    },
    {
      new: true,
      upsert: true
    }
  );
};

module.exports = mongoose.model('Bookmark', bookmarkSchema);