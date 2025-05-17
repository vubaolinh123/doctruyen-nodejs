/**
 * Định nghĩa các virtual fields cho UserLevel model
 * @param {Object} schema - Schema của UserLevel model
 */
const setupVirtuals = (schema) => {
  // Virtual để lấy thông tin người dùng
  schema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });
  
  // Virtual để tính phần trăm kinh nghiệm hiện tại so với cấp độ tiếp theo
  schema.virtual('exp_percentage').get(function() {
    if (this.next_level_exp <= 0) {
      return 100;
    }
    
    return Math.min(100, Math.floor((this.experience / this.next_level_exp) * 100));
  });
};

module.exports = setupVirtuals;
