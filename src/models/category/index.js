const mongoose = require('mongoose');
const categorySchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(categorySchema);

// Thiết lập methods
setupMethods(categorySchema);

// Thiết lập statics
setupStatics(categorySchema);

// Thiết lập hooks
setupHooks(categorySchema);

// Tạo model
const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
