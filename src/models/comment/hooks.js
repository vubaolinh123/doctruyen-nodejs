/**
 * Định nghĩa các hooks cho Comment model
 * @param {Object} schema - Schema của Comment model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Xử lý trước khi lưu bình luận
   */
  schema.pre('save', async function(next) {
    // Nếu là bình luận mới và có parent_id, tăng reply_count của bình luận cha
    if (this.isNew && this.parent_id) {
      try {
        const Comment = this.constructor;
        const parentComment = await Comment.findById(this.parent_id);
        if (parentComment) {
          await parentComment.increaseReplyCount();
        }
      } catch (error) {
        console.error('Lỗi khi cập nhật reply_count:', error);
      }
    }

    next();
  });

  /**
   * Pre-remove hook
   * Xử lý trước khi xóa bình luận
   */
  schema.pre('remove', async function(next) {
    // Nếu có parent_id, giảm reply_count của bình luận cha
    if (this.parent_id) {
      try {
        const Comment = this.constructor;
        const parentComment = await Comment.findById(this.parent_id);
        if (parentComment) {
          await parentComment.decreaseReplyCount();
        }
      } catch (error) {
        console.error('Lỗi khi cập nhật reply_count:', error);
      }
    }

    next();
  });
};

module.exports = setupHooks;
