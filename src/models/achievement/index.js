const mongoose = require('mongoose');
const achievementSchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(achievementSchema);

// Thiết lập methods
setupMethods(achievementSchema);

// Thiết lập statics
setupStatics(achievementSchema);

// Thiết lập hooks
setupHooks(achievementSchema);

// Tạo model
const Achievement = mongoose.model('Achievement', achievementSchema);

module.exports = Achievement;
