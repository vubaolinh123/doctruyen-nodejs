/**
 * Định nghĩa các virtual fields cho Author model
 * @param {Object} schema - Schema của Author model
 */
const setupVirtuals = (schema) => {
  // Virtual để đếm số lượng truyện của tác giả
  schema.virtual('stories', {
    ref: 'Story',
    localField: '_id',
    foreignField: 'author_id',
    count: true
  });
};

module.exports = setupVirtuals;
