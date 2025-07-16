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

  /**
   * Kiểm tra xem tác giả có phải là system author không
   * @returns {boolean} - true nếu là system author
   */
  schema.methods.isSystemAuthor = function() {
    return this.authorType === 'system';
  };

  /**
   * Kiểm tra xem tác giả có phải là external author không
   * @returns {boolean} - true nếu là external author
   */
  schema.methods.isExternalAuthor = function() {
    return this.authorType === 'external';
  };

  /**
   * Lấy thông tin user liên kết (chỉ áp dụng cho system author)
   * @returns {Promise<Object|null>} - Thông tin user hoặc null
   */
  schema.methods.getLinkedUser = async function() {
    if (this.authorType === 'system' && this.userId) {
      const User = require('../user');
      return await User.findById(this.userId);
    }
    return null;
  };
};

module.exports = setupMethods;
