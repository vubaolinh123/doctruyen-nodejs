/**
 * Định nghĩa các instance methods cho Category model
 * @param {Object} schema - Schema của Category model
 */
const setupMethods = (schema) => {
  /**
   * Cập nhật thông tin thể loại
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Thể loại đã cập nhật
   */
  schema.methods.updateInfo = async function(updateData) {
    // Cập nhật các trường được phép
    const allowedFields = ['name', 'description', 'status'];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        this[field] = updateData[field];
      }
    });
    
    return this.save();
  };
};

module.exports = setupMethods;
