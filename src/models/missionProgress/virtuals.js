/**
 * Định nghĩa các virtual fields cho MissionProgress model
 * @param {Object} schema - Schema của MissionProgress model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy thông tin người dùng
  schema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual để lấy thông tin nhiệm vụ
  schema.virtual('mission', {
    ref: 'Mission',
    localField: 'mission_id',
    foreignField: '_id',
    justOne: true
  });
};

module.exports = setupVirtuals;
