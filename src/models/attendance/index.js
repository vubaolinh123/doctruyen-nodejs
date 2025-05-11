const mongoose = require('mongoose');
const attendanceSchema = require('./schema');
const vietnamTimezonePlugin = require('../../plugins/vietnamTimezone');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(attendanceSchema);

// Thiết lập methods
setupMethods(attendanceSchema);

// Thiết lập statics
setupStatics(attendanceSchema);

// Thiết lập hooks
setupHooks(attendanceSchema);

// Áp dụng plugin timezone Việt Nam
attendanceSchema.plugin(vietnamTimezonePlugin);

// Tạo model
const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
