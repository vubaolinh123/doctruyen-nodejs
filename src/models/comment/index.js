const mongoose = require('mongoose');
const commentSchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(commentSchema);

// Thiết lập methods
setupMethods(commentSchema);

// Thiết lập statics
setupStatics(commentSchema);

// Thiết lập hooks
setupHooks(commentSchema);

// Tạo model
const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

module.exports = Comment;
