const mongoose = require('mongoose');

const storiesReadingSchema = new mongoose.Schema({
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    story_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' },
    chapter_id_reading: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    chapter_id_read: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }
  }, { timestamps: true });
  
  module.exports = mongoose.model('StoriesReading', storiesReadingSchema);