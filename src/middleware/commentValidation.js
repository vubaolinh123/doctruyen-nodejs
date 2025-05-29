const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Validation middleware cho comment system
 */

/**
 * Validation cho tạo comment mới
 */
const validateCreateComment = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Nội dung bình luận không được để trống')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Nội dung bình luận phải từ 1-2000 ký tự')
    .custom((value) => {
      // Check for excessive whitespace
      if (value.replace(/\s/g, '').length < 1) {
        throw new Error('Nội dung bình luận không được chỉ chứa khoảng trắng');
      }
      return true;
    }),

  body('target.story_id')
    .notEmpty()
    .withMessage('ID truyện là bắt buộc')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID truyện không hợp lệ');
      }
      return true;
    }),

  body('target.chapter_id')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID chương không hợp lệ');
      }
      return true;
    }),

  body('target.type')
    .isIn(['story', 'chapter'])
    .withMessage('Loại target phải là story hoặc chapter'),

  body('hierarchy.parent_id')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID bình luận cha không hợp lệ');
      }
      return true;
    }),

  body('metadata.chapter_position')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Vị trí trong chương phải là số nguyên không âm'),

  // Custom validation để check consistency
  body().custom((body) => {
    // Nếu type là chapter thì phải có chapter_id
    if (body.target.type === 'chapter' && !body.target.chapter_id) {
      throw new Error('ID chương là bắt buộc khi bình luận trên chương');
    }

    // Nếu có parent_id thì không được có chapter_position
    if (body.hierarchy && body.hierarchy.parent_id && body.metadata && body.metadata.chapter_position) {
      throw new Error('Bình luận phản hồi không thể có vị trí trong chương');
    }

    return true;
  })
];

/**
 * Validation cho update comment
 */
const validateUpdateComment = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID bình luận không hợp lệ');
      }
      return true;
    }),

  body('content')
    .trim()
    .notEmpty()
    .withMessage('Nội dung bình luận không được để trống')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Nội dung bình luận phải từ 1-2000 ký tự'),

  body('edit_reason')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Lý do chỉnh sửa không được quá 200 ký tự')
];

/**
 * Validation cho delete comment
 */
const validateDeleteComment = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID bình luận không hợp lệ');
      }
      return true;
    })
];

/**
 * Validation cho like/dislike comment
 */
const validateLikeComment = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID bình luận không hợp lệ');
      }
      return true;
    }),

  body('action')
    .isIn(['like', 'dislike', 'remove'])
    .withMessage('Action phải là like, dislike hoặc remove')
];

/**
 * Validation cho flag comment
 */
const validateFlagComment = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID bình luận không hợp lệ');
      }
      return true;
    }),

  body('reason')
    .isIn(['spam', 'inappropriate', 'harassment', 'off-topic', 'other'])
    .withMessage('Lý do báo cáo không hợp lệ'),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Mô tả không được quá 500 ký tự')
];

/**
 * Validation cho get comments
 */
const validateGetComments = [
  query('story_id')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID truyện không hợp lệ');
      }
      return true;
    }),

  query('chapter_id')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID chương không hợp lệ');
      }
      return true;
    }),

  query('parent_id')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID bình luận cha không hợp lệ');
      }
      return true;
    }),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit phải từ 1-100'),

  query('cursor')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Cursor không hợp lệ'),

  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'popular'])
    .withMessage('Sort phải là newest, oldest hoặc popular'),

  query('include_replies')
    .optional()
    .isBoolean()
    .withMessage('include_replies phải là boolean')
];

/**
 * Validation cho search comments
 */
const validateSearchComments = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Từ khóa tìm kiếm không được để trống')
    .isLength({ min: 2, max: 100 })
    .withMessage('Từ khóa tìm kiếm phải từ 2-100 ký tự'),

  query('story_id')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID truyện không hợp lệ');
      }
      return true;
    }),

  query('chapter_id')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID chương không hợp lệ');
      }
      return true;
    }),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit phải từ 1-50'),

  query('skip')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Skip phải là số nguyên không âm')
];

/**
 * Validation cho admin moderation
 */
const validateModerationAction = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID bình luận không hợp lệ');
      }
      return true;
    }),

  body('action')
    .isIn(['approve', 'hide', 'delete', 'spam'])
    .withMessage('Action không hợp lệ'),

  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Lý do không được quá 500 ký tự')
];

/**
 * Middleware để handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }

  next();
};

/**
 * Custom validation để check xem story/chapter có tồn tại không
 */
const validateTargetExists = async (req, res, next) => {
  try {
    const { story_id, chapter_id, type } = req.body.target || req.body;

    // Check story exists
    const Story = require('../models/story');
    const story = await Story.findById(story_id).select('_id status');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại'
      });
    }

    if (!story.status) {
      return res.status(403).json({
        success: false,
        message: 'Không thể bình luận trên truyện chưa được xuất bản'
      });
    }

    // Check chapter exists if type is chapter
    if (type === 'chapter' && chapter_id) {
      const Chapter = require('../models/chapter');
      const chapter = await Chapter.findById(chapter_id).select('_id story_id status');

      if (!chapter) {
        return res.status(404).json({
          success: false,
          message: 'Chương không tồn tại'
        });
      }

      if (chapter.story_id.toString() !== story_id) {
        return res.status(400).json({
          success: false,
          message: 'Chương không thuộc về truyện này'
        });
      }

      if (!chapter.status) {
        return res.status(403).json({
          success: false,
          message: 'Không thể bình luận trên chương chưa được xuất bản'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Target validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra dữ liệu'
    });
  }
};

/**
 * Validation để check parent comment exists và level
 */
const validateParentComment = async (req, res, next) => {
  try {
    const { parent_id } = req.body.hierarchy || req.body;

    if (parent_id) {
      const Comment = require('../models/comment');
      const parentComment = await Comment.findById(parent_id).select('hierarchy moderation');

      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: 'Bình luận cha không tồn tại'
        });
      }

      if (parentComment.moderation.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Không thể phản hồi bình luận đã bị xóa hoặc ẩn'
        });
      }

      if (parentComment.hierarchy.level >= 3) {
        return res.status(400).json({
          success: false,
          message: 'Đã đạt giới hạn độ sâu bình luận'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Parent comment validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra bình luận cha'
    });
  }
};

module.exports = {
  validateCreateComment,
  validateUpdateComment,
  validateDeleteComment,
  validateLikeComment,
  validateFlagComment,
  validateGetComments,
  validateSearchComments,
  validateModerationAction,
  handleValidationErrors,
  validateTargetExists,
  validateParentComment
};
