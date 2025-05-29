const moderationService = require('../../services/comment/moderationService');
const cacheService = require('../../services/comment/cacheService');

/**
 * Controller cho comment moderation
 */
class ModerationController {

  /**
   * Lấy queue comments cần moderation
   * @route GET /api/admin/comments/moderation-queue
   */
  async getModerationQueue(req, res) {
    try {
      const {
        status = 'pending',
        limit = 50,
        skip = 0
      } = req.query;

      const options = {
        status,
        limit: parseInt(limit),
        skip: parseInt(skip)
      };

      const result = await moderationService.getModerationQueue(options);

      res.json(result);
    } catch (error) {
      console.error('Error getting moderation queue:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách cần kiểm duyệt'
      });
    }
  }

  /**
   * Thực hiện moderation action
   * @route POST /api/admin/comments/:id/moderate
   */
  async moderateComment(req, res) {
    try {
      const { id } = req.params;
      const moderatorId = req.user._id || req.user.id;
      const { action, reason = '' } = req.body;

      const result = await moderationService.moderateComment(id, moderatorId, action, reason);

      // Invalidate cache
      cacheService.invalidateOnCommentUpdate({ _id: id });

      res.json(result);
    } catch (error) {
      console.error('Error moderating comment:', error);

      if (error.message.includes('không tồn tại')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi kiểm duyệt bình luận'
      });
    }
  }

  /**
   * Bulk moderation cho nhiều comments
   * @route POST /api/admin/comments/bulk-moderate
   */
  async bulkModerateComments(req, res) {
    try {
      const { comment_ids, action, reason = '' } = req.body;
      const moderatorId = req.user._id;

      if (!Array.isArray(comment_ids) || comment_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách comment IDs không hợp lệ'
        });
      }

      if (comment_ids.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Không thể xử lý quá 100 bình luận cùng lúc'
        });
      }

      const result = await moderationService.bulkModerateComments(
        comment_ids,
        moderatorId,
        action,
        reason
      );

      // Invalidate cache
      cacheService.clearAll(); // Clear all cache for bulk operations

      res.json(result);
    } catch (error) {
      console.error('Error bulk moderating comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi kiểm duyệt hàng loạt'
      });
    }
  }

  /**
   * Auto moderation
   * @route POST /api/admin/comments/auto-moderate
   */
  async autoModeration(req, res) {
    try {
      const {
        spam_threshold = 0.8,
        toxicity_threshold = 0.8,
        flag_threshold = 5,
        limit = 100
      } = req.body;

      const options = {
        spam_threshold: parseFloat(spam_threshold),
        toxicity_threshold: parseFloat(toxicity_threshold),
        flag_threshold: parseInt(flag_threshold),
        limit: parseInt(limit)
      };

      const result = await moderationService.autoModeration(options);

      // Invalidate cache
      cacheService.clearAll();

      res.json(result);
    } catch (error) {
      console.error('Error in auto moderation:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi thực hiện tự động kiểm duyệt'
      });
    }
  }

  /**
   * Analyze comment content
   * @route POST /api/admin/comments/:id/analyze
   */
  async analyzeComment(req, res) {
    try {
      const { id } = req.params;

      const Comment = require('../../models/comment');
      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Bình luận không tồn tại'
        });
      }

      const result = await moderationService.analyzeComment(comment);

      res.json(result);
    } catch (error) {
      console.error('Error analyzing comment:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi phân tích bình luận'
      });
    }
  }

  /**
   * Lấy thống kê moderation
   * @route GET /api/admin/comments/moderation-stats
   */
  async getModerationStats(req, res) {
    try {
      const { timeRange = '7d' } = req.query;

      const options = { timeRange };
      const result = await moderationService.getModerationStats(options);

      res.json(result);
    } catch (error) {
      console.error('Error getting moderation stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy thống kê kiểm duyệt'
      });
    }
  }

  /**
   * Lấy danh sách comments bị flag nhiều
   * @route GET /api/admin/comments/highly-flagged
   */
  async getHighlyFlaggedComments(req, res) {
    try {
      const {
        min_flags = 3,
        limit = 50,
        skip = 0
      } = req.query;

      const Comment = require('../../models/comment');
      const comments = await Comment.find({
        'moderation.flags.count': { $gte: parseInt(min_flags) },
        'moderation.status': { $in: ['active', 'pending'] }
      })
        .sort({ 'moderation.flags.count': -1, createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('user_id', 'name avatar slug')
        .populate('target.story_id', 'title slug')
        .populate('target.chapter_id', 'title chapter_number')
        .lean();

      const total = await Comment.countDocuments({
        'moderation.flags.count': { $gte: parseInt(min_flags) },
        'moderation.status': { $in: ['active', 'pending'] }
      });

      res.json({
        success: true,
        data: comments,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error getting highly flagged comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy bình luận bị báo cáo nhiều'
      });
    }
  }

  /**
   * Lấy danh sách comments có spam/toxicity score cao
   * @route GET /api/admin/comments/suspicious
   */
  async getSuspiciousComments(req, res) {
    try {
      const {
        min_spam_score = 0.7,
        min_toxicity_score = 0.7,
        limit = 50,
        skip = 0
      } = req.query;

      const Comment = require('../../models/comment');
      const comments = await Comment.find({
        $or: [
          { 'moderation.auto_moderation.spam_score': { $gte: parseFloat(min_spam_score) } },
          { 'moderation.auto_moderation.toxicity_score': { $gte: parseFloat(min_toxicity_score) } }
        ],
        'moderation.status': { $in: ['active', 'pending'] }
      })
        .sort({
          'moderation.auto_moderation.spam_score': -1,
          'moderation.auto_moderation.toxicity_score': -1,
          createdAt: -1
        })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('user_id', 'name avatar slug')
        .populate('target.story_id', 'title slug')
        .populate('target.chapter_id', 'title chapter_number')
        .lean();

      const total = await Comment.countDocuments({
        $or: [
          { 'moderation.auto_moderation.spam_score': { $gte: parseFloat(min_spam_score) } },
          { 'moderation.auto_moderation.toxicity_score': { $gte: parseFloat(min_toxicity_score) } }
        ],
        'moderation.status': { $in: ['active', 'pending'] }
      });

      res.json({
        success: true,
        data: comments,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error getting suspicious comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy bình luận đáng nghi'
      });
    }
  }

  /**
   * Lấy lịch sử moderation của một comment
   * @route GET /api/admin/comments/:id/moderation-history
   */
  async getModerationHistory(req, res) {
    try {
      const { id } = req.params;

      const Comment = require('../../models/comment');
      const comment = await Comment.findById(id)
        .populate('moderation.moderated_by', 'name')
        .populate('moderation.flags.flagged_by.user_id', 'name')
        .lean();

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Bình luận không tồn tại'
        });
      }

      const history = {
        current_status: comment.moderation.status,
        moderated_by: comment.moderation.moderated_by,
        moderated_at: comment.moderation.moderated_at,
        moderation_reason: comment.moderation.moderation_reason,
        flags: comment.moderation.flags,
        auto_moderation: comment.moderation.auto_moderation,
        edit_history: comment.metadata.edit_history || []
      };

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting moderation history:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy lịch sử kiểm duyệt'
      });
    }
  }

  /**
   * Reset flags của comment
   * @route POST /api/admin/comments/:id/reset-flags
   */
  async resetFlags(req, res) {
    try {
      const { id } = req.params;
      const { reason = 'Admin reset flags' } = req.body;

      const Comment = require('../../models/comment');
      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Bình luận không tồn tại'
        });
      }

      // Reset flags
      comment.moderation.flags.count = 0;
      comment.moderation.flags.reasons = [];
      comment.moderation.flags.flagged_by = [];
      comment.moderation.moderated_by = req.user._id;
      comment.moderation.moderated_at = new Date();
      comment.moderation.moderation_reason = reason;

      await comment.save();

      res.json({
        success: true,
        message: 'Đã reset flags thành công',
        data: {
          comment_id: id,
          flags_reset: true
        }
      });
    } catch (error) {
      console.error('Error resetting flags:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi reset flags'
      });
    }
  }
}

module.exports = new ModerationController();
