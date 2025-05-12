const mongoose = require('mongoose');
const { Schema } = mongoose;

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

module.exports = categorySchema;
