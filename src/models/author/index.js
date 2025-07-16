const mongoose = require('mongoose');
const authorSchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(authorSchema);

// Thiết lập methods
setupMethods(authorSchema);

// Thiết lập statics
setupStatics(authorSchema);

// Thiết lập hooks
setupHooks(authorSchema);

// Tạo model (check if already exists to avoid overwrite error)
const Author = mongoose.models.Author || mongoose.model('Author', authorSchema);

module.exports = Author;
