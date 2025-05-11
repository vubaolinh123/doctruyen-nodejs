/**
 * Định nghĩa các virtual fields cho Attendance model
 * @param {Object} schema - Schema của Attendance model
 */
const setupVirtuals = (schema) => {
  // Virtual để populate thông tin người dùng
  schema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });
};

module.exports = setupVirtuals;
