/**
 * Định nghĩa các instance methods cho Author model
 * @param {Object} schema - Schema của Author model
 */
const setupMethods = (schema) => {
  /**
   * Cập nhật thông tin tác giả
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Tác giả đã cập nhật
   */
  schema.methods.updateInfo = async function(updateData) {
    // Cập nhật các trường được phép
    const allowedFields = ['name', 'status'];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        this[field] = updateData[field];
      }
    });
    
    return this.save();
  };
};

module.exports = setupMethods;
