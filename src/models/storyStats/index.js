const mongoose = require('mongoose');
const storyStatsSchema = require('./schema');
const setupStatics = require('./statics');

// Thiết lập statics
setupStatics(storyStatsSchema);

// Tạo model
const StoryStats = mongoose.model('StoryStats', storyStatsSchema);

module.exports = StoryStats;
