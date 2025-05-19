/**
 * Định nghĩa các virtual properties cho UserRating model
 * @param {Object} schema - Schema của UserRating model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy thông tin người dùng
  schema.virtual('user', {
    ref: 'Customer',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual để lấy thông tin truyện
  schema.virtual('story', {
    ref: 'Story',
    localField: 'story_id',
    foreignField: '_id',
    justOne: true
  });
};

module.exports = setupVirtuals;
