const mongoose = require('mongoose');
const { Schema } = mongoose;
const slugify = require('slugify');

/**
 * Schema cho truyện
 * Lưu thông tin cơ bản của truyện
 */
const storySchema = new Schema({
  // Thông tin cơ bản
  slug: {
    type: String,
    unique: true,
    index: true
  },

  image: {
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

  // Thông tin đánh giá
  stars: {
    type: Number, 
    default: 0,
    min: 0,
    max: 10
  },

  count_star: {
    type: Number,
    default: 0,
    min: 0
  },

  // Thông tin lượt xem
  views: {
    type: Number,
    default: 0,
    min: 0
  },

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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  collection: 'stories'
});

// Tạo các index để tối ưu truy vấn
storySchema.index({ name: 'text', desc: 'text' });
storySchema.index({ createdAt: -1 });
storySchema.index({ updatedAt: -1 });
storySchema.index({ views: -1 });
storySchema.index({ stars: -1 });

// Virtuals
storySchema.virtual('chapters', {
  ref: 'Chapter',
  localField: '_id',
  foreignField: 'story_id'
});

storySchema.virtual('authors', {
  ref: 'Author',
  localField: 'author_id',
  foreignField: '_id'
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
  return this.findOne({ 
    slug: slug,
    status: true
  });
};

// Phương thức tĩnh để tìm truyện nổi bật
storySchema.statics.findHotStories = function(limit = 10) {
  return this.find({ 
    is_hot: true, 
    status: true 
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Phương thức tĩnh để tìm truyện được đánh giá cao
storySchema.statics.findTopRatedStories = function(limit = 10) {
  return this.find({ 
    status: true,
    count_star: { $gt: 0 }
  })
    .sort({ stars: -1, count_star: -1 })
    .limit(limit);
};

// Phương thức tĩnh để tìm truyện mới cập nhật
storySchema.statics.findRecentlyUpdated = function(limit = 10) {
  return this.find({ status: true })
    .sort({ updatedAt: -1 })
    .limit(limit);
};

// Phương thức tĩnh để tìm truyện theo thể loại
storySchema.statics.findByCategory = function(categoryId, limit = 10) {
  return this.find({ 
    categories: categoryId, 
    status: true
  })
    .sort({ updatedAt: -1 })
    .limit(limit);
};

// Phương thức tĩnh để tìm truyện theo tác giả
storySchema.statics.findByAuthor = function(authorId, limit = 10) {
  return this.find({ 
    author_id: authorId, 
    status: true
  })
    .sort({ updatedAt: -1 })
    .limit(limit);
};

// Phương thức tĩnh để tìm truyện theo từ khóa
storySchema.statics.search = function(keyword, limit = 10) {
  return this.find({
    $text: { $search: keyword },
    status: true
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit);
};

module.exports = mongoose.model('Story', storySchema);