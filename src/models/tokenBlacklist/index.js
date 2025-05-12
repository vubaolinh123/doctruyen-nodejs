const mongoose = require('mongoose');
const tokenBlacklistSchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(tokenBlacklistSchema);

// Thiết lập methods
setupMethods(tokenBlacklistSchema);

// Thiết lập statics
setupStatics(tokenBlacklistSchema);

// Thiết lập hooks
setupHooks(tokenBlacklistSchema);

// Tạo model
const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

module.exports = { TokenBlacklist };
