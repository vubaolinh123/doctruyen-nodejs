/**
 * Models index file
 * Ensures all models are properly loaded and registered with Mongoose
 * This prevents "Schema hasn't been registered" errors
 */

// Core models
require('./user');
require('./story');
require('./chapter');
require('./category');
require('./author');

// Transaction and purchase models
require('./transaction');
require('./purchasedStory');
require('./userPurchases');

// Authentication and permission models
require('./refreshToken');
require('./tokenBlacklist');
require('./userPermission');
require('./permissionTemplate');

// User engagement models
require('./userLevel');           // ✅ Now properly loaded
require('./attendance');
require('./userAttendanceReward');
require('./attendanceReward');
require('./comment');
require('./notification');
require('./storiesReading');
require('./userRating');

// Mission and achievement models
require('./mission');
require('./missionProgress');
require('./achievement');
require('./achievementProgress');

// Content management models
require('./slide');
require('./seoConfig');
require('./cacheConfig');
require('./storyStats');
require('./storyRankings');

// System models
require('./systemSettings');

console.log('✅ All models loaded successfully');

module.exports = {
  // Export commonly used models for convenience
  User: require('./user'),
  Story: require('./story'),
  Chapter: require('./chapter'),
  Category: require('./category'),
  Author: require('./author'),
  Transaction: require('./transaction'),
  UserLevel: require('./userLevel'),
  Mission: require('./mission'),
  MissionProgress: require('./missionProgress'),
  Achievement: require('./achievement'),
  AchievementProgress: require('./achievementProgress'),
  Attendance: require('./attendance'),
  Comment: require('./comment'),
  Notification: require('./notification')
};
