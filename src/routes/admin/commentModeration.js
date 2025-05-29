const express = require('express');
const router = express.Router();
const commentController = require('../../controllers/comment');
const { authenticateToken } = require('../../middleware/auth');

// Import validation middleware
const {
  validateModerationAction,
  handleValidationErrors
} = require('../../middleware/commentValidation');

// Middleware để check admin permissions
const checkAdminPermission = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập'
    });
  }

  // Check if user has admin role or moderation permission
  if (req.user.role !== 'admin' && 
      (!req.user.permissions || !req.user.permissions.moderate_comments)) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền kiểm duyệt bình luận'
    });
  }

  next();
};

// === MODERATION ROUTES ===

// Get moderation queue
router.get('/queue',
  authenticateToken,
  checkAdminPermission,
  commentController.getModerationQueue
);

// Moderate single comment
router.post('/:id/moderate',
  authenticateToken,
  checkAdminPermission,
  validateModerationAction,
  handleValidationErrors,
  commentController.moderateComment
);

// Bulk moderate comments
router.post('/bulk-moderate',
  authenticateToken,
  checkAdminPermission,
  (req, res, next) => {
    // Validate bulk moderation data
    const { comment_ids, action } = req.body;

    if (!Array.isArray(comment_ids) || comment_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'comment_ids phải là array không rỗng'
      });
    }

    if (!['approve', 'hide', 'delete', 'spam'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action không hợp lệ'
      });
    }

    next();
  },
  commentController.bulkModerateComments
);

// Auto moderation
router.post('/auto-moderate',
  authenticateToken,
  checkAdminPermission,
  commentController.autoModeration
);

// Analyze comment
router.post('/:id/analyze',
  authenticateToken,
  checkAdminPermission,
  commentController.analyzeComment
);

// Get moderation stats
router.get('/stats',
  authenticateToken,
  checkAdminPermission,
  commentController.getModerationStats
);

// Get highly flagged comments
router.get('/highly-flagged',
  authenticateToken,
  checkAdminPermission,
  commentController.getHighlyFlaggedComments
);

// Get suspicious comments
router.get('/suspicious',
  authenticateToken,
  checkAdminPermission,
  commentController.getSuspiciousComments
);

// Get moderation history
router.get('/:id/history',
  authenticateToken,
  checkAdminPermission,
  commentController.getModerationHistory
);

// Reset flags
router.post('/:id/reset-flags',
  authenticateToken,
  checkAdminPermission,
  commentController.resetFlags
);

module.exports = router;
