const slugify = require('slugify');
const mongoose = require('mongoose');

/**
 * Định nghĩa các hooks cho Chapter model
 * @param {Object} schema - Schema của Chapter model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Tự động tạo slug và cập nhật chapter_count trong Story
   */
  schema.pre('save', async function(next) {
    // Tạo slug nếu chưa có
    if (!this.slug && this.name) {
      this.slug = slugify(`chuong-${this.chapter}-${this.name}`, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
    }

    // Nếu là chapter mới (không phải cập nhật), tăng chapter_count trong Story
    if (this.isNew) {
      try {
        const Story = mongoose.model('Story');
        await Story.findByIdAndUpdate(
          this.story_id,
          { $inc: { chapter_count: 1 } }
        );
        console.log(`Tăng chapter_count cho truyện ${this.story_id}`);
      } catch (error) {
        console.error('Lỗi khi cập nhật chapter_count:', error);
      }
    }

    next();
  });

  /**
   * Pre-remove hook
   * Giảm chapter_count trong Story khi xóa chapter
   */
  schema.pre('remove', async function(next) {
    try {
      const Story = mongoose.model('Story');
      await Story.findByIdAndUpdate(
        this.story_id,
        { $inc: { chapter_count: -1 } }
      );
      console.log(`Giảm chapter_count cho truyện ${this.story_id}`);
    } catch (error) {
      console.error('Lỗi khi cập nhật chapter_count:', error);
    }
    next();
  });
};

module.exports = setupHooks;
