const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment');
const { authenticateToken } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const commentValidation = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Nội dung bình luận không được để trống')
    .isLength({ max: 1000 })
    .withMessage('Nội dung bình luận không được quá 1000 ký tự'),
  body('story_id')
    .notEmpty()
    .withMessage('ID truyện là bắt buộc')
    .isMongoId()
    .withMessage('ID truyện không hợp lệ'),
  body('chapter_id')
    .optional()
    .isMongoId()
    .withMessage('ID chương không hợp lệ'),
  body('parent_id')
    .optional()
    .isMongoId()
    .withMessage('ID bình luận cha không hợp lệ'),
  body('position')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Vị trí không hợp lệ')
];

// Public routes
router.get('/', commentController.getComments);

// Protected routes
router.post('/', authenticateToken, commentValidation, commentController.createComment);
router.put('/:id', authenticateToken, commentController.updateComment);
router.delete('/:id', authenticateToken, commentController.deleteComment);
router.post('/:id/like', authenticateToken, commentController.toggleLike);

module.exports = router; 