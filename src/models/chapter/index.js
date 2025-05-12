const mongoose = require('mongoose');
const chapterSchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(chapterSchema);

// Thiết lập methods
setupMethods(chapterSchema);

// Thiết lập statics
setupStatics(chapterSchema);

// Thiết lập hooks
setupHooks(chapterSchema);

// Tạo model
const Chapter = mongoose.model('Chapter', chapterSchema);

module.exports = Chapter;
