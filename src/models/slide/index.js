const mongoose = require('mongoose');
const slideSchema = require('./schema');
const applyVirtuals = require('./virtuals');
const applyStatics = require('./statics');

// Apply virtuals and statics
applyVirtuals(slideSchema);
applyStatics(slideSchema);

// Create and export the model
module.exports = mongoose.model('Slide', slideSchema); 