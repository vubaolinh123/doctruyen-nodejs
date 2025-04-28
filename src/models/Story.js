const mongoose = require('mongoose');
const { Schema } = mongoose;
const slugify = require('slugify');

/**
 * Schema cho truyện
 * Lưu thông tin cơ bản của truyện
 */
const storySchema = new Schema({
  // Thông tin cơ bản
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  slug: {
    type: String,
    unique: true,
    index: true
  },

  image: {
    type: String,
    default: ''
  },

  desc: {
    type: String,
    default: ''
  },

  // Tham chiếu đến tác giả
  author_id: {
    type: Schema.Types.ObjectId,
    ref: 'Author',
    index: true
  },

  // Thông tin thể loại
  categories: [{
    type: Schema.Types.ObjectId,
    ref: 'Category'
  }],

  // Thông tin trạng thái
  status: {
    type: Number,
    enum: [0, 1, 2], // 0: Đang cập nhật, 1: Hoàn thành, 2: Tạm ngưng
    default: 0,
    index: true
  },

  approve: {
    type: Number,
    enum: [0, 1], // 0: Chưa duyệt, 1: Đã duyệt
    default: 0,
    index: true
  },

  is_full: {
    type: Number,
    enum: [0, 1], // 0: Chưa hoàn thành, 1: Đã hoàn thành
    default: 0
  },

  // Thông tin nổi bật
  is_hot: {
    type: Number,
    enum: [0, 1], // 0: Không nổi bật, 1: Nổi bật
    default: 0,
    index: true
  },

  hot_day: {
    type: Date,
    default: null
  },

  hot_month: {
    type: Date,
    default: null
  },

  hot_all_time: {
    type: Number,
    default: 0
  },

  show_slider: {
    type: Number,
    enum: [0, 1], // 0: Không hiển thị trên slider, 1: Hiển thị trên slider
    default: 0
  },

  // Thông tin lượt xem
  views: {
    type: Number,
    default: 0,
    min: 0
  },

  // Thông tin mua truyện
  tra_phi: {
    type: Number,
    enum: [0, 1], // 0: Miễn phí, 1: Trả phí
    default: 0
  },

  coin_mua: {
    type: Number,
    default: 0,
    min: 0
  },

  // Thông tin bổ sung
  crawl_link: {
    type: String,
    default: ''
  },

  // Thông tin thống kê
  total_chapters: {
    type: Number,
    default: 0,
    min: 0
  },

  total_comments: {
    type: Number,
    default: 0,
    min: 0
  },

  total_bookmarks: {
    type: Number,
    default: 0,
    min: 0
  },

  average_rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },

  total_ratings: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
storySchema.index({ name: 'text', desc: 'text' });
storySchema.index({ createdAt: -1 });
storySchema.index({ updatedAt: -1 });
storySchema.index({ views: -1 });
storySchema.index({ is_hot: 1, hot_day: -1 });
storySchema.index({ is_hot: 1, hot_month: -1 });
storySchema.index({ is_hot: 1, hot_all_time: -1 });
storySchema.index({ status: 1, approve: 1 });

// Virtuals
storySchema.virtual('chapters', {
  ref: 'Chapter',
  localField: '_id',
  foreignField: 'story_id'
});

storySchema.virtual('author', {
  ref: 'Author',
  localField: 'author_id',
  foreignField: '_id',
  justOne: true
});

storySchema.virtual('bookmarks', {
  ref: 'Bookmark',
  localField: '_id',
  foreignField: 'story_id'
});

storySchema.virtual('ratings', {
  ref: 'Star',
  localField: '_id',
  foreignField: 'story_id'
});

// Middleware pre-save
storySchema.pre('save', function(next) {
  // Tạo slug nếu chưa có
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      locale: 'vi'
    });
  }

  next();
});

// Phương thức tĩnh để tìm truyện theo slug
storySchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug });
};

// Phương thức tĩnh để tìm truyện nổi bật
storySchema.statics.findHotStories = function(limit = 10) {
  return this.find({ is_hot: 1, approve: 1 })
    .sort({ hot_day: -1 })
    .limit(limit);
};

// Phương thức tĩnh để tìm truyện mới cập nhật
storySchema.statics.findRecentlyUpdated = function(limit = 10) {
  return this.find({ approve: 1 })
    .sort({ updatedAt: -1 })
    .limit(limit);
};

// Phương thức tĩnh để tìm truyện theo thể loại
storySchema.statics.findByCategory = function(categoryId, limit = 10) {
  return this.find({ categories: categoryId, approve: 1 })
    .sort({ updatedAt: -1 })
    .limit(limit);
};

// Phương thức tĩnh để tìm truyện theo tác giả
storySchema.statics.findByAuthor = function(authorId, limit = 10) {
  return this.find({ author_id: authorId, approve: 1 })
    .sort({ updatedAt: -1 })
    .limit(limit);
};

// Phương thức tĩnh để tìm truyện theo từ khóa
storySchema.statics.search = function(keyword, limit = 10) {
  return this.find({
    $text: { $search: keyword },
    approve: 1
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit);
};

// Phương thức tĩnh để tăng lượt xem
storySchema.statics.increaseViews = async function(storyId) {
  return this.findByIdAndUpdate(storyId, { $inc: { views: 1 } });
};

module.exports = mongoose.model('Story', storySchema);