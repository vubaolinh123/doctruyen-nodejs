/**
 * Định nghĩa các virtual fields cho AchievementProgress model
 * @param {Object} schema - Schema của AchievementProgress model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy thông tin người dùng
  schema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual để lấy thông tin thành tựu
  schema.virtual('achievement', {
    ref: 'Achievement',
    localField: 'achievement_id',
    foreignField: '_id',
    justOne: true
  });
};

module.exports = setupVirtuals;
