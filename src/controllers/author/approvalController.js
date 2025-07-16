const authorApprovalService = require('../../services/author/authorApprovalService');

/**
 * Controller xử lý phê duyệt tác giả
 */

/**
 * Lấy danh sách tác giả đang chờ phê duyệt
 * @route GET /api/admin/authors/pending
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getPendingAuthors = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await authorApprovalService.getPendingAuthors({ page, limit });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tác giả đang chờ phê duyệt:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Phê duyệt đơn đăng ký tác giả
 * @route POST /api/admin/authors/:id/approve
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.approveAuthor = async (req, res) => {
  try {
    const authorId = req.params.id;
    const adminId = req.user.id;

    const result = await authorApprovalService.approveAuthor(authorId, adminId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Lỗi khi phê duyệt tác giả:', error);
    
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Không thể phê duyệt')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Từ chối đơn đăng ký tác giả
 * @route POST /api/admin/authors/:id/reject
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.rejectAuthor = async (req, res) => {
  try {
    const authorId = req.params.id;
    const adminId = req.user.id;
    const { reason } = req.body;

    const result = await authorApprovalService.rejectAuthor(authorId, adminId, reason);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Lỗi khi từ chối tác giả:', error);
    
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Không thể từ chối')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Xóa author record bị từ chối để cho phép đăng ký lại
 * @route DELETE /api/authors/rejected/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.deleteRejectedAuthor = async (req, res) => {
  try {
    const authorId = req.params.id;
    const userId = req.user.id;

    console.log('[ApprovalController] deleteRejectedAuthor called with:', { authorId, userId });

    const result = await authorApprovalService.deleteRejectedAuthor(authorId, userId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Lỗi khi xóa author bị từ chối:', error);

    if (error.message === 'Không tìm thấy tác giả' ||
        error.message === 'Bạn không có quyền xóa author này' ||
        error.message === 'Chỉ có thể xóa author có trạng thái rejected') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};
