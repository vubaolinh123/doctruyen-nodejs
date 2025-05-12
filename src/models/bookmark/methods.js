/**
 * Định nghĩa các instance methods cho Bookmark model
 * @param {Object} schema - Schema của Bookmark model
 */
const setupMethods = (schema) => {
  /**
   * Cập nhật thông tin bookmark
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Bookmark đã cập nhật
   */
  schema.methods.updateInfo = async function(updateData) {
    // Cập nhật các trường được phép
    const allowedFields = ['chapter_id', 'note', 'position'];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        this[field] = updateData[field];
      }
    });
    
    return this.save();
  };
};

module.exports = setupMethods;
