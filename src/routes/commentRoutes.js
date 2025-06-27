const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment');
const { authenticateToken, optional } = require('../middleware/auth');

// Import middleware
const {
  commentRateLimit,
  createCommentRateLimit,
  likeRateLimit,
  flagRateLimit,
  spamDetection,
  contentValidation,
  ipSuspiciousActivityDetection,
  checkCommentPermission
} = require('../middleware/commentRateLimit');

const {
  validateCreateComment,
  validateUpdateComment,
  validateDeleteComment,
  validateLikeComment,
  validateFlagComment,
  validateGetComments,
  validateSearchComments,
  handleValidationErrors,
  validateTargetExists,
  validateParentComment
} = require('../middleware/commentValidation');

// === PUBLIC ROUTES ===

// Get comments (with optional auth for user interaction info)
router.get('/',
  optional,
  commentRateLimit,
  validateGetComments,
  handleValidationErrors,
  commentController.getComments
);

// Search comments
router.get('/search',
  commentRateLimit,
  validateSearchComments,
  handleValidationErrors,
  commentController.searchComments
);

// CRITICAL FIX: Move chapter route BEFORE /:id/thread to prevent route conflicts
// Get comments by chapter ID
router.get('/chapter/:chapterId',
  optional,
  commentRateLimit,
  async (req, res, next) => {
    try {
      // CRITICAL FIX: Fetch story_id from chapter_id to satisfy service requirements
      const chapterId = req.params.chapterId;

      // Validate chapter ID format
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(chapterId)) {
        return res.status(400).json({
          success: false,
          message: 'ID chương không hợp lệ'
        });
      }

      // Fetch chapter to get story_id
      const Chapter = require('../models/chapter');
      const chapter = await Chapter.findById(chapterId).select('story_id').lean();

      if (!chapter) {
        return res.status(404).json({
          success: false,
          message: 'Chương không tồn tại'
        });
      }

      // FIXED: Pass chapter and story IDs via req.params to handle null prototype req.query
      req.params.chapter_id = chapterId;
      req.params.story_id = chapter.story_id.toString();

      next();
    } catch (error) {
      console.error('[CommentRoute] Error fetching chapter:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tải thông tin chương'
      });
    }
  },
  commentController.getComments
);

// Get comment thread
router.get('/:id/thread',
  optional,
  commentRateLimit,
  commentController.getCommentThread
);

// Get comment stats
router.get('/stats',
  commentRateLimit,
  commentController.getCommentStats
);

// Get hot comments
router.get('/hot',
  commentRateLimit,
  commentController.getHotComments
);

// Get parent comment info for persistent reply form
router.get('/:commentId/parent-info',
  commentRateLimit,
  commentController.getParentCommentInfo
);

// === PROTECTED ROUTES ===

// Create comment
router.post('/',
  authenticateToken,
  checkCommentPermission,
  createCommentRateLimit,
  spamDetection,
  ipSuspiciousActivityDetection,
  contentValidation,
  validateCreateComment,
  handleValidationErrors,
  validateTargetExists,
  validateParentComment,
  commentController.createComment
);

// Update comment
router.put('/:id',
  authenticateToken,
  commentRateLimit,
  contentValidation,
  validateUpdateComment,
  handleValidationErrors,
  commentController.updateComment
);

// Delete comment
router.delete('/:id',
  authenticateToken,
  commentRateLimit,
  validateDeleteComment,
  handleValidationErrors,
  commentController.deleteComment
);

// Like/Dislike/Remove reaction
router.post('/:id/reaction',
  authenticateToken,
  likeRateLimit,
  validateLikeComment,
  handleValidationErrors,
  commentController.toggleReaction
);

// Flag comment
router.post('/:id/flag',
  authenticateToken,
  flagRateLimit,
  validateFlagComment,
  handleValidationErrors,
  commentController.flagComment
);

module.exports = router;