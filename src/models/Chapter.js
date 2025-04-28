const mongoose = require('mongoose');
const { Schema } = mongoose;
const slugify = require('slugify');

/**
 * Schema cho chapter
 * Lưu thông tin các chapter của truyện
 */
const chapterSchema = new Schema({
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
    type: String,
    index: true
  },

  // Nội dung chapter
  content1: {
    type: String,
    default: ''
  },

  content2: {
    type: String,
    default: ''
  },

  // Thông tin audio
  audio: {
    type: String,
    default: ''
  },

  audio_show: {
    type: Number,
    enum: [0, 1], // 0: Không hiển thị audio, 1: Hiển thị audio
    default: 0
  },

  // Thông tin trạng thái
  is_new: {
    type: Number,
    enum: [0, 1], // 0: Không mới, 1: Mới
    default: 0,
    index: true
  },

  required_login: {
    type: Number,
    enum: [0, 1], // 0: Không yêu cầu đăng nhập, 1: Yêu cầu đăng nhập
    default: 0
  },

  // Thông tin mua chapter
  tra_phi: {
    type: Number,
    enum: [0, 1], // 0: Miễn phí, 1: Trả phí
    default: 0,
    index: true
  },

  coin_mua: {
    type: Number,
    default: 0,
    min: 0
  },

  // Thông tin loại chapter
  type: {
    type: String,
    enum: ['text', 'image', 'mixed'],
    default: 'text'
  },

  // Thông tin bổ sung
  crawl_link: {
    type: String,
    default: ''
  },

  // Thông tin thống kê
  views: {
    type: Number,
    default: 0,
    min: 0
  },

  total_comments: {
    type: Number,
    default: 0,
    min: 0
  },

  // Thông tin sắp xếp
  order: {
    type: Number,
    default: 0
  },

  // Thông tin trạng thái
  status: {
    type: Number,
    enum: [0, 1], // 0: Ẩn, 1: Hiển thị
    default: 1,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
chapterSchema.index({ story_id: 1, chapter: 1 });
chapterSchema.index({ story_id: 1, createdAt: -1 });
chapterSchema.index({ story_id: 1, status: 1 });
chapterSchema.index({ story_id: 1, tra_phi: 1 });
chapterSchema.index({ createdAt: -1 });

// Virtuals
chapterSchema.virtual('story', {
  ref: 'Story',
  localField: 'story_id',
  foreignField: '_id',
  justOne: true
});

// Middleware pre-save
chapterSchema.pre('save', function(next) {
  // Tạo slug nếu chưa có
  if (!this.slug && this.name) {
    this.slug = slugify(`${this.chapter}-${this.name}`, {
      lower: true,
      strict: true,
      locale: 'vi'
    });
  }

  next();
});

// Phương thức tĩnh để tìm chapter theo story_id và chapter number
chapterSchema.statics.findByStoryAndNumber = function(storyId, chapterNumber) {
  return this.findOne({
    story_id: storyId,
    chapter: chapterNumber,
    status: 1
  });
};

// Phương thức tĩnh để tìm chapter theo story_id và slug
chapterSchema.statics.findByStoryAndSlug = function(storyId, slug) {
  return this.findOne({
    story_id: storyId,
    slug: slug,
    status: 1
  });
};

// Phương thức tĩnh để lấy danh sách chapter của truyện
chapterSchema.statics.findByStory = function(storyId, limit = 0, skip = 0) {
  const query = this.find({
    story_id: storyId,
    status: 1
  }).sort({ chapter: 1 });

  if (limit > 0) {
    query.limit(limit);
  }

  if (skip > 0) {
    query.skip(skip);
  }

  return query;
};

// Phương thức tĩnh để lấy chapter mới nhất của truyện
chapterSchema.statics.findLatestByStory = function(storyId) {
  return this.findOne({
    story_id: storyId,
    status: 1
  }).sort({ chapter: -1 });
};

// Phương thức tĩnh để lấy chapter đầu tiên của truyện
chapterSchema.statics.findFirstByStory = function(storyId) {
  return this.findOne({
    story_id: storyId,
    status: 1
  }).sort({ chapter: 1 });
};

// Phương thức tĩnh để lấy chapter tiếp theo
chapterSchema.statics.findNextChapter = function(storyId, currentChapter) {
  return this.findOne({
    story_id: storyId,
    chapter: { $gt: currentChapter },
    status: 1
  }).sort({ chapter: 1 });
};

// Phương thức tĩnh để lấy chapter trước đó
chapterSchema.statics.findPreviousChapter = function(storyId, currentChapter) {
  return this.findOne({
    story_id: storyId,
    chapter: { $lt: currentChapter },
    status: 1
  }).sort({ chapter: -1 });
};

// Phương thức tĩnh để tăng lượt xem
chapterSchema.statics.increaseViews = async function(chapterId) {
  return this.findByIdAndUpdate(chapterId, { $inc: { views: 1 } });
};

module.exports = mongoose.model('Chapter', chapterSchema);