const mongoose = require('mongoose');

const slideSchema = new mongoose.Schema({
    picture: String,
    isActive: Number
}, { timestamps: true });

module.exports = slideSchema; 