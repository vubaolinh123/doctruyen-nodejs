/**
 * Định nghĩa các virtual fields cho Mission model
 * @param {Object} schema - Schema của Mission model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy danh sách tiến trình của nhiệm vụ
  schema.virtual('progress', {
    ref: 'MissionProgress',
    localField: '_id',
    foreignField: 'mission_id'
  });
};

module.exports = setupVirtuals;
