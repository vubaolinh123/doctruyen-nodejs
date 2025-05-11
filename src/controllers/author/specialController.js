const authorService = require('../../services/author/authorService');

/**
 * Lấy tác giả theo slug
 * @route GET /api/authors/slug/:slug
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getBySlug = async (req, res) => {
  try {
    const author = await authorService.getAuthorBySlug(req.params.slug);
    return res.json({
      success: true,
      data: author
    });
  } catch (error) {
    console.error('Lỗi khi lấy tác giả theo slug:', error);
    
    if (error.message === 'Không tìm thấy tác giả') {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy tác giả' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ nội bộ' 
    });
  }
};

/**
 * Lấy tất cả tác giả đang hoạt động
 * @route GET /api/authors/active
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getActive = async (req, res) => {
  try {
    const { limit } = req.query;
    const authors = await authorService.getActiveAuthors(limit);
    return res.json({
      success: true,
      data: authors
    });
  } catch (error) {
    console.error('Lỗi khi lấy tác giả đang hoạt động:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ nội bộ' 
    });
  }
}; 