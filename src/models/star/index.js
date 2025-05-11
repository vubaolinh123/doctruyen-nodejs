const mongoose = require('mongoose');
const starSchema = require('./schema');
const applyVirtuals = require('./virtuals');
const applyStatics = require('./statics');

// Apply virtuals and statics
applyVirtuals(starSchema);
applyStatics(starSchema);

// Create and export the model
module.exports = mongoose.model('Star', starSchema); 