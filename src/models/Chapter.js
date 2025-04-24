const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
    story_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' },
    chapter: Number,
    name: String,
    slug: String,
    content1: String,
    content2: String,
    crawl_link: String,
    audio: String,
    audio_show: Number,
    is_new: Number,
    required_login: Number,
    tra_phi: Number,
    coin_mua: Number,
    type: String
  }, { timestamps: true });
  
  module.exports = mongoose.model('Chapter', chapterSchema);