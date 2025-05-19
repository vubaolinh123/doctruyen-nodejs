const mongoose = require('mongoose');
const storyRankingsSchema = require('./schema');
const setupStatics = require('./statics');

// Thiết lập statics
setupStatics(storyRankingsSchema);

// Tạo model
const StoryRankings = mongoose.model('StoryRankings', storyRankingsSchema);

module.exports = StoryRankings;
