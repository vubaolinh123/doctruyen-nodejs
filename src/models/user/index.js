const mongoose = require('mongoose');
const userSchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(userSchema);

// Thiết lập methods
setupMethods(userSchema);

// Thiết lập statics
setupStatics(userSchema);

// Thiết lập hooks
setupHooks(userSchema);

// Tạo model
const User = mongoose.model('User', userSchema);

module.exports = User; 