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

// Virtuals
storiesReadingSchema.virtual('story', {
  ref: 'Story',
  localField: 'story_id',
  foreignField: '_id',
  justOne: true
});

storiesReadingSchema.virtual('chapter_reading', {
  ref: 'Chapter',
  localField: 'chapter_id_reading',
  foreignField: '_id',
  justOne: true
});

storiesReadingSchema.virtual('chapter_read', {
  ref: 'Chapter',
  localField: 'chapter_id_read',
  foreignField: '_id',
  justOne: true
});

storiesReadingSchema.virtual('user', {
  ref: 'User',
  localField: 'user_id',
  foreignField: '_id',
  justOne: true
});

// Phương thức tĩnh để tìm lịch sử đọc theo user_id và story_id
storiesReadingSchema.statics.findByCustomerAndStory = function(userId, storyId) {
  return this.findOne({
    user_id: userId,
    story_id: storyId
  });
};

// Phương thức tĩnh để lấy danh sách lịch sử đọc của người dùng
storiesReadingSchema.statics.findByCustomer = function(userId, limit = 10, skip = 0) {
  return this.find({
    user_id: userId
  })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('story', 'name slug image')
    .populate('chapter_reading', 'name chapter');
};

// Phương thức tĩnh để cập nhật hoặc tạo mới lịch sử đọc
storiesReadingSchema.statics.upsertReading = async function(userId, storyId, chapterId, position = 0) {
  return this.findOneAndUpdate(
    { user_id: userId, story_id: storyId },
    {
      chapter_id_reading: chapterId,
      reading_position: position,
      $inc: { read_count: 1 },
      $setOnInsert: { user_id: userId, story_id: storyId }
    },
    {
      new: true,
      upsert: true
    }
  );
};

// Phương thức tĩnh để cập nhật chapter đã đọc
storiesReadingSchema.statics.updateChapterRead = async function(userId, storyId, chapterId) {
  return this.findOneAndUpdate(
    { user_id: userId, story_id: storyId },
    {
      chapter_id_read: chapterId
    },
    {
      new: true
    }
  );
};

module.exports = mongoose.model('StoriesReading', storiesReadingSchema);