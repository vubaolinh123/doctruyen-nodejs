/**
 * Định nghĩa các virtual fields cho RefreshToken model
 * @param {Object} schema - Schema của RefreshToken model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy thông tin user
  schema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true
  });

  // Virtual để tính thời gian còn lại
  schema.virtual('remainingTime').get(function() {
    if (this.expiresAt) {
      const now = new Date();
      const diff = this.expiresAt.getTime() - now.getTime();
      return Math.max(0, Math.floor(diff / 1000)); // Trả về số giây còn lại
    }
    return 0;
  });
};

module.exports = setupVirtuals;
