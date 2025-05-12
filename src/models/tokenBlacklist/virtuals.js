/**
 * Định nghĩa các virtual fields cho TokenBlacklist model
 * @param {Object} schema - Schema của TokenBlacklist model
 */
const setupVirtuals = (schema) => {
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
