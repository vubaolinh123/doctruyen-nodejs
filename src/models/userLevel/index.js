const mongoose = require('mongoose');
const userLevelSchema = require('./schema');
const vietnamTimezonePlugin = require('../../plugins/vietnamTimezone');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(userLevelSchema);

// Thiết lập methods
setupMethods(userLevelSchema);

// Thiết lập statics
setupStatics(userLevelSchema);

// Thiết lập hooks
setupHooks(userLevelSchema);

// Áp dụng plugin timezone Việt Nam
userLevelSchema.plugin(vietnamTimezonePlugin);

// Tạo model
const UserLevel = mongoose.model('UserLevel', userLevelSchema);

module.exports = UserLevel;
