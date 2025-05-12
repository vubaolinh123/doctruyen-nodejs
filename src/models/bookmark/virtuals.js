/**
 * Định nghĩa các virtual fields cho Bookmark model
 * @param {Object} schema - Schema của Bookmark model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy thông tin truyện
  schema.virtual('story', {
    ref: 'Story',
    localField: 'story_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual để lấy thông tin chapter
  schema.virtual('chapter', {
    ref: 'Chapter',
    localField: 'chapter_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual để lấy thông tin người dùng
  schema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });
};

module.exports = setupVirtuals;
