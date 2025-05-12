/**
 * Định nghĩa các virtual fields cho Chapter model
 * @param {Object} schema - Schema của Chapter model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy thông tin truyện
  schema.virtual('story', {
    ref: 'Story',
    localField: 'story_id',
    foreignField: '_id',
    justOne: true
  });
};

module.exports = setupVirtuals;
