const mongoose = require('mongoose');
const refreshTokenSchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(refreshTokenSchema);

// Thiết lập methods
setupMethods(refreshTokenSchema);

// Thiết lập statics
setupStatics(refreshTokenSchema);

// Thiết lập hooks
setupHooks(refreshTokenSchema);

// Tạo model
const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = { RefreshToken };
