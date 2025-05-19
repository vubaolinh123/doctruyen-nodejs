const mongoose = require('mongoose');
const userRatingSchema = require('./schema');
const applyVirtuals = require('./virtuals');
const applyStatics = require('./statics');

// Apply virtuals and statics
applyVirtuals(userRatingSchema);
applyStatics(userRatingSchema);

// Create and export the model
module.exports = mongoose.model('UserRating', userRatingSchema);
