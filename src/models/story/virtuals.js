/**
 * Định nghĩa các virtual fields cho Story model
 * @param {Object} schema - Schema của Story model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy danh sách chapters của truyện
  schema.virtual('chapters', {
    ref: 'Chapter',
    localField: '_id',
    foreignField: 'story_id'
  });

  // Virtual để lấy thông tin tác giả
  schema.virtual('authors', {
    ref: 'Author',
    localField: 'author_id',
    foreignField: '_id'
  });
};

module.exports = setupVirtuals;
