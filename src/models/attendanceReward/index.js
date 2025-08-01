const mongoose = require('mongoose');
const schema = require('./schema');
const statics = require('./statics');
const methods = require('./methods');
const hooks = require('./hooks');
const virtuals = require('./virtuals');

// Apply các extensions
statics(schema);
methods(schema);
hooks(schema);
virtuals(schema);

// Tạo model với tên mới
const AttendanceMilestone = mongoose.model('AttendanceMilestone', schema);

module.exports = AttendanceMilestone;
