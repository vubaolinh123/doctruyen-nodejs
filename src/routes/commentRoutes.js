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