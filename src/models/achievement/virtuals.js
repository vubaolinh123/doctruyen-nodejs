/**
 * Định nghĩa các virtual fields cho Achievement model
 * @param {Object} schema - Schema của Achievement model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy danh sách tiến trình của thành tựu
  schema.virtual('progress', {
    ref: 'AchievementProgress',
    localField: '_id',
    foreignField: 'achievement_id'
  });
};

module.exports = setupVirtuals;
