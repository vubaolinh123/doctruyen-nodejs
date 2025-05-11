const commentService = require('../../services/comment/commentService');
const { validationResult } = require('express-validator');

/**
 * Lấy danh sách bình luận
 * @route GET /api/comments
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getComments = async (req, res) => {
  try {
    const { story_id, chapter_id, parent_id, page, limit } = req.query;
    
    const result = await commentService.getComments({ 
      story_id, 
      chapter_id, 
      parent_id, 
      page, 
      limit 
    });
    
    res.json({
      success: true,
      data: result.comments,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bình luận:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách bình luận'
    });
  }
};

/**
 * Tạo bình luận mới
 * @route POST /api/comments
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.createComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const customer_id = req.user._id;
    const comment = await commentService.createComment(customer_id, req.body);
    
    res.status(201).json({
      success: true,
      message: 'Bình luận đã được tạo thành công',
      data: comment
    });
  } catch (error) {
    console.error('Lỗi khi tạo bình luận:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo bình luận'
    });
  }
};

/**
 * Cập nhật bình luận
 * @route PUT /api/comments/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const customer_id = req.user._id;
    
    const comment = await commentService.updateComment(id, customer_id, content);
    
    res.json({
      success: true,
      message: 'Bình luận đã được cập nhật thành công',
      data: comment
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật bình luận:', error);
    
    if (error.message === 'Bình luận không tồn tại hoặc bạn không có quyền chỉnh sửa') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật bình luận'
    });
  }
};

/**
 * Xóa bình luận (soft delete)
 * @route DELETE /api/comments/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const customer_id = req.user._id;
    
    await commentService.deleteComment(id, customer_id);
    
    res.json({
      success: true,
      message: 'Xóa bình luận thành công'
    });
  } catch (error) {
    console.error('Lỗi khi xóa bình luận:', error);
    
    if (error.message === 'Bình luận không tồn tại hoặc bạn không có quyền xóa') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa bình luận'
    });
  }
}; 