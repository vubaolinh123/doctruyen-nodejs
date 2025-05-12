const mongoose = require('mongoose');
const { Schema } = mongoose;

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
    type: String
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
authorSchema.index({ createdAt: -1 });

module.exports = authorSchema;
