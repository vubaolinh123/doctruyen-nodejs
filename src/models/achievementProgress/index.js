const mongoose = require('mongoose');
const achievementProgressSchema = require('./schema');
const vietnamTimezonePlugin = require('../../plugins/vietnamTimezone');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(achievementProgressSchema);

// Thiết lập methods
setupMethods(achievementProgressSchema);

// Thiết lập statics
setupStatics(achievementProgressSchema);

// Thiết lập hooks
setupHooks(achievementProgressSchema);

// Áp dụng plugin timezone Việt Nam
achievementProgressSchema.plugin(vietnamTimezonePlugin);

// Tạo model
const AchievementProgress = mongoose.model('AchievementProgress', achievementProgressSchema);

module.exports = AchievementProgress;
