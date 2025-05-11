const commentService = require('../../services/comment/commentService');

/**
 * Like/Unlike bình luận
 * @route POST /api/comments/:id/like
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user._id;
    
    const result = await commentService.toggleLike(id, user_id);
    
    res.json({
      success: true,
      message: result.message,
      data: {
        likes: result.likes,
        hasLiked: result.hasLiked
      }
    });
  } catch (error) {
    console.error('Lỗi khi thích/bỏ thích bình luận:', error);
    
    if (error.message === 'Bình luận không tồn tại') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi khi thích/bỏ thích bình luận'
    });
  }
}; 