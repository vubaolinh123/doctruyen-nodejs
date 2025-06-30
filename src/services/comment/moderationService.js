const Comment = require('../../models/comment');

/**
 * Service xử lý moderation cho comment system
 */
class ModerationService {

  /**
   * Lấy queue comments cần moderation
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Comments cần review
   */
  async getModerationQueue(options = {}) {
    try {
      const result = await Comment.getModerationQueue(options);
      
      return {
        success: true,
        data: result.comments,
        pagination: result.pagination
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Thực hiện moderation action
   * @param {ObjectId} commentId - ID của comment
   * @param {ObjectId} moderatorId - ID của moderator
   * @param {String} action - 'approve', 'hide', 'delete', 'spam'
   * @param {String} reason - Lý do moderation
   * @returns {Promise<Object>} - Kết quả moderation
   */
  async moderateComment(commentId, moderatorId, action, reason = '') {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Bình luận không tồn tại');
      }

      // Update moderation status
      const oldStatus = comment.moderation.status;
      
      switch (action) {
        case 'approve':
          comment.moderation.status = 'active';
          break;
        case 'hide':
          comment.moderation.status = 'hidden';
          break;
        case 'delete':
          comment.moderation.status = 'deleted';
          break;
        case 'spam':
          comment.moderation.status = 'spam';
          break;
        default:
          throw new Error('Action không hợp lệ');
      }

      comment.moderation.moderated_by = moderatorId;
      comment.moderation.moderated_at = new Date();
      comment.moderation.moderation_reason = reason;

      await comment.save();

      // Log moderation action
      console.log(`Comment ${commentId} moderated by ${moderatorId}: ${oldStatus} -> ${action}`);

      return {
        success: true,
        message: `Bình luận đã được ${this.getActionMessage(action)}`,
        data: {
          comment_id: commentId,
          old_status: oldStatus,
          new_status: comment.moderation.status,
          moderated_by: moderatorId,
          reason
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk moderation cho nhiều comments
   * @param {Array} commentIds - Danh sách comment IDs
   * @param {ObjectId} moderatorId - ID của moderator
   * @param {String} action - Moderation action
   * @param {String} reason - Lý do moderation
   * @returns {Promise<Object>} - Kết quả bulk moderation
   */
  async bulkModerateComments(commentIds, moderatorId, action, reason = '') {
    try {
      const results = [];
      const errors = [];

      for (const commentId of commentIds) {
        try {
          const result = await this.moderateComment(commentId, moderatorId, action, reason);
          results.push(result.data);
        } catch (error) {
          errors.push({
            comment_id: commentId,
            error: error.message
          });
        }
      }

      return {
        success: true,
        message: `Đã xử lý ${results.length}/${commentIds.length} bình luận`,
        data: {
          successful: results,
          failed: errors,
          total_processed: commentIds.length
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Auto moderation dựa trên spam score và toxicity
   * @param {Object} options - Auto moderation options
   * @returns {Promise<Object>} - Kết quả auto moderation
   */
  async autoModeration(options = {}) {
    try {
      const {
        spam_threshold = 0.8,
        toxicity_threshold = 0.8,
        flag_threshold = 5,
        limit = 100
      } = options;

      // Find comments that need auto moderation
      const query = {
        'moderation.status': 'active',
        $or: [
          { 'moderation.auto_moderation.spam_score': { $gte: spam_threshold } },
          { 'moderation.auto_moderation.toxicity_score': { $gte: toxicity_threshold } },
          { 'moderation.flags.count': { $gte: flag_threshold } }
        ]
      };

      const comments = await Comment.find(query)
        .limit(limit)
        .sort({ 'moderation.flags.count': -1, createdAt: -1 });

      const results = [];

      for (const comment of comments) {
        let action = 'pending';
        let reason = '';

        // Determine action based on scores
        if (comment.moderation.auto_moderation.spam_score >= spam_threshold) {
          action = 'spam';
          reason = `Auto-detected spam (score: ${comment.moderation.auto_moderation.spam_score})`;
        } else if (comment.moderation.auto_moderation.toxicity_score >= toxicity_threshold) {
          action = 'hidden';
          reason = `Auto-detected toxic content (score: ${comment.moderation.auto_moderation.toxicity_score})`;
        } else if (comment.moderation.flags.count >= flag_threshold) {
          action = 'pending';
          reason = `Multiple user reports (${comment.moderation.flags.count} flags)`;
        }

        // Update comment
        comment.moderation.status = action;
        comment.moderation.moderation_reason = reason;
        comment.moderation.moderated_at = new Date();
        await comment.save();

        results.push({
          comment_id: comment._id,
          action,
          reason,
          spam_score: comment.moderation.auto_moderation.spam_score,
          toxicity_score: comment.moderation.auto_moderation.toxicity_score,
          flag_count: comment.moderation.flags.count
        });
      }

      return {
        success: true,
        message: `Auto moderation completed: ${results.length} comments processed`,
        data: results
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tính toán spam score cho comment
   * @param {String} content - Nội dung comment
   * @param {Object} metadata - Metadata của comment
   * @returns {Number} - Spam score (0-1)
   */
  calculateSpamScore(content, metadata = {}) {
    let score = 0;

    // Check for excessive caps
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.7) score += 0.3;

    // Check for excessive special characters
    const specialCharsRatio = (content.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length / content.length;
    if (specialCharsRatio > 0.5) score += 0.3;

    // Check for repeated characters
    const repeatedChars = content.match(/(.)\1{4,}/g);
    if (repeatedChars && repeatedChars.length > 0) score += 0.2;

    // Check for common spam patterns
    const spamPatterns = [
      /click\s+here/i,
      /free\s+money/i,
      /make\s+money/i,
      /visit\s+my\s+website/i,
      /http[s]?:\/\//i,
      /www\./i
    ];

    spamPatterns.forEach(pattern => {
      if (pattern.test(content)) score += 0.2;
    });

    // Check for excessive length
    if (content.length > 1500) score += 0.1;

    // Check for very short content with links
    if (content.length < 10 && /http[s]?:\/\//.test(content)) score += 0.4;

    return Math.min(score, 1);
  }

  /**
   * Tính toán toxicity score cho comment
   * @param {String} content - Nội dung comment
   * @returns {Number} - Toxicity score (0-1)
   */
  calculateToxicityScore(content) {
    let score = 0;

    // Vietnamese toxic words (basic list)
    const toxicWords = [
      'đm', 'dm', 'đmm', 'dmm', 'đcm', 'dcm',
      'cc', 'cặc', 'lồn', 'buồi', 'chó', 'súc vật',
      'ngu', 'ngốc', 'khùng', 'điên', 'óc chó',
      'thằng ngu', 'con ngu', 'đồ ngu', 'đồ khùng'
    ];

    const lowerContent = content.toLowerCase();
    
    toxicWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) {
        score += matches.length * 0.2;
      }
    });

    // Check for excessive aggressive punctuation
    const aggressivePunctuation = content.match(/[!]{3,}|[?]{3,}/g);
    if (aggressivePunctuation) score += 0.1;

    // Check for all caps aggressive words
    const capsWords = content.match(/[A-Z]{4,}/g);
    if (capsWords && capsWords.length > 2) score += 0.2;

    return Math.min(score, 1);
  }

  /**
   * Analyze comment content và set auto moderation scores
   * @param {Object} comment - Comment object
   * @returns {Promise<Object>} - Updated comment với scores
   */
  async analyzeComment(comment) {
    try {
      const content = comment.content.original;
      
      // Calculate scores
      const spamScore = this.calculateSpamScore(content, comment.metadata);
      const toxicityScore = this.calculateToxicityScore(content);

      // Update comment
      comment.moderation.auto_moderation.spam_score = spamScore;
      comment.moderation.auto_moderation.toxicity_score = toxicityScore;
      comment.moderation.auto_moderation.checked_at = new Date();

      // Auto-flag if scores are high
      if (spamScore >= 0.7 || toxicityScore >= 0.7) {
        comment.moderation.status = 'pending';
      }

      await comment.save();

      return {
        success: true,
        data: {
          comment_id: comment._id,
          spam_score: spamScore,
          toxicity_score: toxicityScore,
          status: comment.moderation.status
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thống kê moderation
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} - Moderation statistics
   */
  async getModerationStats(options = {}) {
    try {
      const { timeRange = '7d' } = options;

      // Calculate date range
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const stats = await Comment.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalComments: { $sum: 1 },
            activeComments: {
              $sum: { $cond: [{ $eq: ['$moderation.status', 'active'] }, 1, 0] }
            },
            pendingComments: {
              $sum: { $cond: [{ $eq: ['$moderation.status', 'pending'] }, 1, 0] }
            },
            hiddenComments: {
              $sum: { $cond: [{ $eq: ['$moderation.status', 'hidden'] }, 1, 0] }
            },
            deletedComments: {
              $sum: { $cond: [{ $eq: ['$moderation.status', 'deleted'] }, 1, 0] }
            },
            spamComments: {
              $sum: { $cond: [{ $eq: ['$moderation.status', 'spam'] }, 1, 0] }
            },
            flaggedComments: {
              $sum: { $cond: [{ $gt: ['$moderation.flags.count', 0] }, 1, 0] }
            },
            avgSpamScore: { $avg: '$moderation.auto_moderation.spam_score' },
            avgToxicityScore: { $avg: '$moderation.auto_moderation.toxicity_score' }
          }
        }
      ]);

      return {
        success: true,
        data: stats[0] || {
          totalComments: 0,
          activeComments: 0,
          pendingComments: 0,
          hiddenComments: 0,
          deletedComments: 0,
          spamComments: 0,
          flaggedComments: 0,
          avgSpamScore: 0,
          avgToxicityScore: 0
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Helper method để get action message
   * @param {String} action - Moderation action
   * @returns {String} - Action message
   */
  getActionMessage(action) {
    const messages = {
      'approve': 'phê duyệt',
      'hide': 'ẩn',
      'delete': 'xóa',
      'spam': 'đánh dấu là spam'
    };
    
    return messages[action] || 'xử lý';
  }

  /**
   * Hard delete a comment (permanent removal from database)
   * @param {ObjectId} commentId - ID của comment
   * @param {ObjectId} moderatorId - ID của moderator
   * @param {String} reason - Lý do xóa cứng
   * @returns {Promise<Object>} - Kết quả xóa cứng
   */
  async hardDeleteComment(commentId, moderatorId, reason = '') {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Bình luận không tồn tại');
      }

      // Store comment info for logging before deletion
      const commentInfo = {
        id: comment._id,
        userId: comment.user_id,
        content: comment.content.original,
        target: comment.target,
        createdAt: comment.createdAt
      };

      // Permanently remove the comment from database
      await Comment.findByIdAndDelete(commentId);

      // Log the hard deletion for audit trail
      console.log(`[AUDIT] Hard Delete - Comment permanently removed:`, {
        commentId: commentInfo.id,
        moderatorId,
        reason,
        originalContent: commentInfo.content,
        target: commentInfo.target,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Bình luận đã được xóa cứng thành công',
        data: {
          deletedCommentId: commentId,
          moderatorId,
          reason,
          deletedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Error in hardDeleteComment:', error);
      throw error;
    }
  }

  /**
   * Bulk hard delete comments (permanent removal from database)
   * @param {Array} commentIds - Array of comment IDs
   * @param {ObjectId} moderatorId - ID của moderator
   * @param {String} reason - Lý do xóa cứng
   * @returns {Promise<Object>} - Kết quả xóa cứng hàng loạt
   */
  async bulkHardDeleteComments(commentIds, moderatorId, reason = '') {
    try {
      // Get comment info before deletion for logging
      const comments = await Comment.find({ _id: { $in: commentIds } });

      if (comments.length === 0) {
        throw new Error('Không tìm thấy bình luận nào để xóa');
      }

      const commentInfos = comments.map(comment => ({
        id: comment._id,
        userId: comment.user_id,
        content: comment.content.original,
        target: comment.target,
        createdAt: comment.createdAt
      }));

      // Permanently remove all comments from database
      const deleteResult = await Comment.deleteMany({ _id: { $in: commentIds } });

      // Log the bulk hard deletion for audit trail
      console.log(`[AUDIT] Bulk Hard Delete - ${deleteResult.deletedCount} comments permanently removed:`, {
        commentIds,
        moderatorId,
        reason,
        deletedCount: deleteResult.deletedCount,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: `Đã xóa cứng ${deleteResult.deletedCount} bình luận thành công`,
        data: {
          deletedCount: deleteResult.deletedCount,
          deletedCommentIds: commentIds,
          moderatorId,
          reason,
          deletedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Error in bulkHardDeleteComments:', error);
      throw error;
    }
  }
}

module.exports = new ModerationService();
