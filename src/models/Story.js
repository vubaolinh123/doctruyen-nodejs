const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    slug: String,
    image: String,
    name: String,
    desc: String,
    crawl_link: String,
    author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' },
    tra_phi: Number,
    coin_mua: Number,
    views: Number,
    status: Number,
    approve: Number,
    is_full: Number,
    is_hot: Number,
    hot_day: Date,
    hot_month: Date,
    hot_all_time: Number,
    show_slider: Number
  }, { timestamps: true });
  
  module.exports = mongoose.model('Story', storySchema);