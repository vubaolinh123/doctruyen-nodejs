const mongoose = require('mongoose');
const { Schema } = mongoose;
const slugify = require('slugify');

/**
 * Schema cho tác giả
 * Lưu thông tin các tác giả của truyện
 */
const authorSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  slug: {
    type: String,
    index: true
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
authorSchema.index({ name: 1 });
authorSchema.index({ slug: 1 });
authorSchema.index({ status: 1 });
authorSchema.index({ createdAt: -1 });

// Middleware pre-save
authorSchema.pre('save', function(next) {
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

// Phương thức tĩnh để tìm tác giả theo slug
authorSchema.statics.findBySlug = function(slug) {
  return this.findOne({
    slug: slug,
    status: true
  });
};

// Phương thức tĩnh để lấy danh sách tác giả đang hoạt động
authorSchema.statics.findActive = function(limit = 0, skip = 0) {
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

module.exports = mongoose.model('Author', authorSchema);