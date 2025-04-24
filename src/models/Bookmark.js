const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
    story_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' },
    chapter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }
  }, { timestamps: true });
  
  module.exports = mongoose.model('Bookmark', bookmarkSchema);