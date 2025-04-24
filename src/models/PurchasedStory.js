const mongoose = require('mongoose');

const purchasedStorySchema = new mongoose.Schema({
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    story_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' },
    coin_bought: Number
  }, { timestamps: true });
  
  module.exports = mongoose.model('PurchasedStory', purchasedStorySchema);