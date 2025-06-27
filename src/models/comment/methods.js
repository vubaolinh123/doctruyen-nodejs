/**
 * Instance methods cho Comment model
 * Các phương thức được gọi trên instance của comment
 */
const setupMethods = (schema) => {

  /**
   * Thêm like cho comment
   * @param {ObjectId} userId - ID của user
   * @returns {Promise<Object>} - Kết quả operation
   */
  schema.methods.addLike = async function(userId) {
    try {
      // Kiểm tra đã like chưa
      if (this.engagement.likes.users.includes(userId)) {
        return { success: false, message: 'Đã thích comment này rồi' };
      }

      // Remove dislike nếu có
      const dislikeIndex = this.engagement.dislikes.users.indexOf(userId);
      if (dislikeIndex > -1) {
        this.engagement.dislikes.users.splice(dislikeIndex, 1);
        this.engagement.dislikes.count = Math.max(0, this.engagement.dislikes.count - 1);
      }

      // Add like
      this.engagement.likes.users.push(userId);
      this.engagement.likes.count += 1;

      // Update engagement score
      this.updateEngagementScore();

      await this.save();
      return {
        success: true,
        message: 'Đã thích comment',
        likes: this.engagement.likes.count,
        dislikes: this.engagement.dislikes.count
      };
    } catch (error) {
      throw error;
    }
  };

  /**
   * Thêm dislike cho comment
   * @param {ObjectId} userId - ID của user
   * @returns {Promise<Object>} - Kết quả operation
   */
  schema.methods.addDislike = async function(userId) {
    try {
      // Kiểm tra đã dislike chưa
      if (this.engagement.dislikes.users.includes(userId)) {
        return { success: false, message: 'Đã không thích comment này rồi' };
      }

      // Remove like nếu có
      const likeIndex = this.engagement.likes.users.indexOf(userId);
      if (likeIndex > -1) {
        this.engagement.likes.users.splice(likeIndex, 1);
        this.engagement.likes.count = Math.max(0, this.engagement.likes.count - 1);
      }

      // Add dislike
      this.engagement.dislikes.users.push(userId);
      this.engagement.dislikes.count += 1;

      // Update engagement score
      this.updateEngagementScore();

      await this.save();
      return {
        success: true,
        message: 'Đã không thích comment',
        likes: this.engagement.likes.count,
        dislikes: this.engagement.dislikes.count
      };
    } catch (error) {
      throw error;
    }
  };

  /**
   * Remove like/dislike
   * @param {ObjectId} userId - ID của user
   * @returns {Promise<Object>} - Kết quả operation
   */
  schema.methods.removeLikeDislike = async function(userId) {
    try {
      let removed = false;
      let action = '';

      // Remove like
      const likeIndex = this.engagement.likes.users.indexOf(userId);
      if (likeIndex > -1) {
        this.engagement.likes.users.splice(likeIndex, 1);
        this.engagement.likes.count = Math.max(0, this.engagement.likes.count - 1);
        removed = true;
        action = 'like';
      }

      // Remove dislike
      const dislikeIndex = this.engagement.dislikes.users.indexOf(userId);
      if (dislikeIndex > -1) {
        this.engagement.dislikes.users.splice(dislikeIndex, 1);
        this.engagement.dislikes.count = Math.max(0, this.engagement.dislikes.count - 1);
        removed = true;
        action = 'dislike';
      }

      if (removed) {
        this.updateEngagementScore();
        await this.save();
        return {
          success: true,
          message: `Đã bỏ ${action === 'like' ? 'thích' : 'không thích'}`,
          likes: this.engagement.likes.count,
          dislikes: this.engagement.dislikes.count
        };
      }

      return { success: false, message: 'Chưa có reaction nào' };
    } catch (error) {
      throw error;
    }
  };

  /**
   * Cập nhật engagement score
   * Score = likes - dislikes + (replies * 0.5) + time_decay_factor
   */
  schema.methods.updateEngagementScore = function() {
    const likes = this.engagement.likes.count || 0;
    const dislikes = this.engagement.dislikes.count || 0;
    const replies = this.engagement.replies.count || 0;

    // Time decay factor (newer comments get higher score)
    const ageInHours = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
    const timeDecay = Math.max(0, 1 - (ageInHours / 168)); // Decay over 1 week

    this.engagement.score = (likes - dislikes) + (replies * 0.5) + (timeDecay * 2);
  };

  /**
   * Flag comment
   * @param {ObjectId} userId - ID của user flag
   * @param {String} reason - Lý do flag
   * @returns {Promise<Object>} - Kết quả operation
   */
  schema.methods.addFlag = async function(userId, reason) {
    try {
      // Kiểm tra đã flag chưa
      const existingFlag = this.moderation.flags.flagged_by.find(
        flag => flag.user_id.toString() === userId.toString()
      );

      if (existingFlag) {
        return { success: false, message: 'Đã báo cáo comment này rồi' };
      }

      // Add flag
      this.moderation.flags.flagged_by.push({
        user_id: userId,
        reason: reason,
        flagged_at: new Date()
      });

      this.moderation.flags.count += 1;
      if (!this.moderation.flags.reasons.includes(reason)) {
        this.moderation.flags.reasons.push(reason);
      }

      // Auto hide if too many flags
      if (this.moderation.flags.count >= 5 && this.moderation.status === 'active') {
        this.moderation.status = 'pending';
      }

      await this.save();
      return {
        success: true,
        message: 'Đã báo cáo comment',
        flags: this.moderation.flags.count
      };
    } catch (error) {
      throw error;
    }
  };

  /**
   * Soft delete comment
   * @param {String} reason - Lý do xóa
   * @returns {Promise<void>}
   */
  schema.methods.softDelete = async function(reason = 'User deleted') {
    this.moderation.status = 'deleted';
    this.moderation.moderation_reason = reason;
    this.moderation.moderated_at = new Date();
    await this.save();
  };

  /**
   * Kiểm tra user có thể edit comment không
   * @param {ObjectId} userId - ID của user
   * @returns {Boolean}
   */
  schema.methods.canEdit = function(userId) {
    const isOwner = this.user_id.toString() === userId.toString();
    const isActive = this.moderation.status === 'active';

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Comment.canEdit] Debug:', {
        commentId: this._id,
        userId: userId.toString(),
        commentUserId: this.user_id.toString(),
        isOwner,
        moderationStatus: this.moderation.status,
        isActive,
        canEdit: isOwner && isActive
      });
    }

    // Allow users to edit their own comments indefinitely (no time limit)
    // Only check ownership and comment status
    return isOwner && isActive;
  };

  /**
   * Edit comment content
   * @param {String|Object} newContent - Nội dung mới (string hoặc object với original property)
   * @param {String} reason - Lý do edit
   * @returns {Promise<void>}
   */
  schema.methods.editContent = async function(newContent, reason = '') {
    // Extract content string from object or use as string
    let contentString = '';
    if (typeof newContent === 'string') {
      contentString = newContent;
    } else if (typeof newContent === 'object' && newContent && newContent.original) {
      contentString = newContent.original;
    } else {
      throw new Error('Content must be a string or object with original property');
    }

    // Validate extracted content
    if (!contentString || typeof contentString !== 'string') {
      throw new Error('Extracted content must be a non-empty string');
    }

    // Save edit history
    this.metadata.edit_history.push({
      content: this.content.original,
      edited_at: new Date(),
      edit_reason: reason
    });

    // Update content
    this.content.original = contentString;
    this.content.sanitized = this.sanitizeContent(contentString);

    await this.save();
  };

  /**
   * Sanitize content (remove XSS, format mentions)
   * @param {String} content - Raw content
   * @returns {String} - Sanitized content
   */
  schema.methods.sanitizeContent = function(content) {
    // Basic XSS prevention
    let sanitized = content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // Process mentions (@username)
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push({
        username: match[1],
        position: match.index
      });
    }

    this.content.mentions = mentions;
    return sanitized;
  };

  /**
   * Get full hierarchy path as array
   * @returns {Array} - Array of comment IDs in path
   */
  schema.methods.getPathArray = function() {
    if (!this.hierarchy.path) return [];
    return this.hierarchy.path
      .split('/')
      .filter(id => id.length > 0);
  };

  /**
   * Build materialized path
   * @param {String} parentPath - Parent's path
   * @returns {String} - New path
   */
  schema.methods.buildPath = function(parentPath = '') {
    return parentPath + this._id.toString() + '/';
  };
};

module.exports = setupMethods;
