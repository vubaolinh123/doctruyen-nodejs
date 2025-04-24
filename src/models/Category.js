const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    slug: String,
    name: String,
    desc: String
  }, { timestamps: true });
  
  module.exports = mongoose.model('Category', categorySchema);