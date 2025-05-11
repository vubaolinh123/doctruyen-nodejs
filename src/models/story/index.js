const mongoose = require('mongoose');
const storySchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(storySchema);

// Thiết lập methods
setupMethods(storySchema);

// Thiết lập statics
setupStatics(storySchema);

// Thiết lập hooks
setupHooks(storySchema);

// Tạo model
const Story = mongoose.model('Story', storySchema);

module.exports = Story;
