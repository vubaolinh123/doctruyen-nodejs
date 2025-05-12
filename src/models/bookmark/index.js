const mongoose = require('mongoose');
const bookmarkSchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(bookmarkSchema);

// Thiết lập methods
setupMethods(bookmarkSchema);

// Thiết lập statics
setupStatics(bookmarkSchema);

// Thiết lập hooks
setupHooks(bookmarkSchema);

// Tạo model
const Bookmark = mongoose.model('Bookmark', bookmarkSchema);

module.exports = Bookmark;
