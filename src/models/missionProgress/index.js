const mongoose = require('mongoose');
const missionProgressSchema = require('./schema');
const vietnamTimezonePlugin = require('../../plugins/vietnamTimezone');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(missionProgressSchema);

// Thiết lập methods
setupMethods(missionProgressSchema);

// Thiết lập statics
setupStatics(missionProgressSchema);

// Thiết lập hooks
setupHooks(missionProgressSchema);

// Áp dụng plugin timezone Việt Nam
missionProgressSchema.plugin(vietnamTimezonePlugin);

// Tạo model
const MissionProgress = mongoose.model('MissionProgress', missionProgressSchema);

module.exports = MissionProgress;
