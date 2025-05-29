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

// Tạo model
const UserAttendanceReward = mongoose.model('UserAttendanceReward', schema);

module.exports = UserAttendanceReward;
