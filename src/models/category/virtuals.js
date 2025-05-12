/**
 * Định nghĩa các virtual fields cho Category model
 * @param {Object} schema - Schema của Category model
 */
const setupVirtuals = (schema) => {
  // Virtual để đếm số lượng truyện thuộc thể loại này
  schema.virtual('stories', {
    ref: 'Story',
    localField: '_id',
    foreignField: 'categories',
    count: true
  });
};

module.exports = setupVirtuals;
