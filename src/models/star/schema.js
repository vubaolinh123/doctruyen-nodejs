const mongoose = require('mongoose');

const starSchema = new mongoose.Schema({
    story_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' },
    controller_name: String,
    stars: Number,
    count: Number,
    approved: Number
}, { timestamps: true });

module.exports = starSchema; 