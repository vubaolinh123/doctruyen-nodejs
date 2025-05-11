/**
 * Định nghĩa các instance methods cho Attendance model
 * @param {Object} schema - Schema của Attendance model
 */
const setupMethods = (schema) => {
  /**
   * Cập nhật thông tin điểm danh
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Bản ghi đã cập nhật
   */
  schema.methods.updateAttendanceInfo = async function(updateData) {
    // Cập nhật các trường được phép
    const allowedFields = ['notes', 'bonus_reward'];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        this[field] = updateData[field];
      }
    });
    
    // Cập nhật tổng phần thưởng nếu có thay đổi bonus_reward
    if (updateData.bonus_reward !== undefined) {
      this.reward = 10 + updateData.bonus_reward; // 10 là phần thưởng cơ bản
    }
    
    return this.save();
  };
};

module.exports = setupMethods;
