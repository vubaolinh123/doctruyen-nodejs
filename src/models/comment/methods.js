/**
 * Định nghĩa các instance methods cho Comment model
 * @param {Object} schema - Schema của Comment model
 */
const setupMethods = (schema) => {
  /**
   * Thêm like cho bình luận
   * @param {string} customerId - ID của người dùng thích bình luận
   * @returns {Promise<boolean>} - Kết quả thêm like
   */
  schema.methods.addLike = async function(customerId) {
    if (!this.liked_by.includes(customerId)) {
      this.liked_by.push(customerId);
      this.likes++;
      await this.save();
      return true;
    }
    return false;
  };

  /**
   * Bỏ like cho bình luận
   * @param {string} customerId - ID của người dùng bỏ thích bình luận
   * @returns {Promise<boolean>} - Kết quả bỏ like
   */
  schema.methods.removeLike = async function(customerId) {
    const index = this.liked_by.indexOf(customerId);
    if (index !== -1) {
      this.liked_by.splice(index, 1);
      this.likes--;
      await this.save();
      return true;
    }
    return false;
  };

  /**
   * Ẩn bình luận
   * @returns {Promise<void>}
   */
  schema.methods.hide = async function() {
    this.status = 'hidden';
    await this.save();
  };

  /**
   * Xóa mềm bình luận
   * @returns {Promise<void>}
   */
  schema.methods.softDelete = async function() {
    this.status = 'deleted';
    await this.save();
  };

  /**
   * Cập nhật nội dung bình luận
   * @param {string} newContent - Nội dung mới
   * @returns {Promise<Object>} - Bình luận đã cập nhật
   */
  schema.methods.updateContent = async function(newContent) {
    if (newContent && newContent.trim()) {
      this.content = newContent.trim();
      return this.save();
    }
    throw new Error('Nội dung bình luận không được để trống');
  };

  /**
   * Tăng số lượng bình luận con
   * @returns {Promise<void>}
   */
  schema.methods.increaseReplyCount = async function() {
    this.reply_count++;
    await this.save();
  };

  /**
   * Giảm số lượng bình luận con
   * @returns {Promise<void>}
   */
  schema.methods.decreaseReplyCount = async function() {
    if (this.reply_count > 0) {
      this.reply_count--;
      await this.save();
    }
  };
};

module.exports = setupMethods;
