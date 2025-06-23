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

    // Track if isPaid status is changing for auto-update logic
    const isPaidChanged = this.isModified('isPaid');
    const isNewChapter = this.isNew;

    // Nếu là chapter mới (không phải cập nhật), tăng chapter_count trong Story
    if (isNewChapter) {
      try {
        const Story = mongoose.model('Story');
        await Story.findByIdAndUpdate(
          this.story_id,
          { $inc: { chapter_count: 1 } }
        );
        console.log(`[Chapter Hook] Tăng chapter_count cho truyện ${this.story_id}`);
      } catch (error) {
        console.error('[Chapter Hook] Lỗi khi cập nhật chapter_count:', error);
      }
    }

    next();
  });

  /**
   * Post-save hook
   * AUTO-UPDATE: Update story's hasPaidChapters field when chapter isPaid status changes
   */
  schema.post('save', async function(doc) {
    try {
      // Import hasPaidChaptersService dynamically to avoid circular dependency
      const hasPaidChaptersService = require('../../services/story/hasPaidChaptersService');

      // Always update hasPaidChapters for new chapters or when isPaid changes
      if (doc.isNew || doc.isModified('isPaid')) {
        await hasPaidChaptersService.updateStoryHasPaidChapters(doc.story_id);
        console.log(`[Chapter Hook] Auto-updated hasPaidChapters for story ${doc.story_id} after chapter save`);
      }
    } catch (error) {
      console.error('[Chapter Hook] Error auto-updating hasPaidChapters after save:', error);
      // Don't throw error - chapter save should succeed even if hasPaidChapters update fails
    }
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
      console.log(`[Chapter Hook] Giảm chapter_count cho truyện ${this.story_id}`);
    } catch (error) {
      console.error('[Chapter Hook] Lỗi khi cập nhật chapter_count:', error);
    }
    next();
  });

  /**
   * Post-remove hook
   * AUTO-UPDATE: Update story's hasPaidChapters field when chapter is deleted
   */
  schema.post('remove', async function(doc) {
    try {
      // Import hasPaidChaptersService dynamically to avoid circular dependency
      const hasPaidChaptersService = require('../../services/story/hasPaidChaptersService');

      // Update hasPaidChapters after chapter deletion (especially if it was a paid chapter)
      await hasPaidChaptersService.updateStoryHasPaidChapters(doc.story_id);
      console.log(`[Chapter Hook] Auto-updated hasPaidChapters for story ${doc.story_id} after chapter deletion`);
    } catch (error) {
      console.error('[Chapter Hook] Error auto-updating hasPaidChapters after deletion:', error);
      // Don't throw error - chapter deletion should succeed even if hasPaidChapters update fails
    }
  });
};

module.exports = setupHooks;
