/**
 * Định nghĩa các virtual fields cho Comment model
 * @param {Object} schema - Schema của Comment model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy thông tin người dùng
  schema.virtual('user', {
    ref: 'User',
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

  // Virtual để lấy thông tin chương
  schema.virtual('chapter', {
    ref: 'Chapter',
    localField: 'chapter_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual để lấy danh sách bình luận con
  schema.virtual('replies', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'parent_id'
  });
};

module.exports = setupVirtuals;
