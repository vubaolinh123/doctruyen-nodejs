const mongoose = require('mongoose');
const { Schema } = mongoose;
const slugify = require('slugify');

/**
 * Schema cho thể loại truyện
 * Lưu thông tin các thể loại của truyện
 */
const categorySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  slug: {
    type: String
  },
  
  description: {
    type: String,
    default: ''
  },
  
  status: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo index cho các trường tìm kiếm phổ biến
categorySchema.index({ name: 1 });
categorySchema.index({ createdAt: -1 });

// Middleware pre-save
categorySchema.pre('save', function(next) {
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

// Virtual để đếm số lượng truyện thuộc thể loại này
categorySchema.virtual('stories', {
  ref: 'Story',
  localField: '_id',
  foreignField: 'categories',
  count: true
});

// Phương thức tĩnh để tìm thể loại theo slug
categorySchema.statics.findBySlug = function(slug) {
  return this.findOne({
    slug: slug,
    status: true
  });
};

// Phương thức tĩnh để lấy danh sách thể loại đang hoạt động
categorySchema.statics.findActive = function(limit = 0, skip = 0) {
  const query = this.find({
    status: true
  }).sort({ name: 1 });

  if (limit > 0) {
    query.limit(limit);
  }

  if (skip > 0) {
    query.skip(skip);
  }

  return query;
};

module.exports = mongoose.model('Category', categorySchema);