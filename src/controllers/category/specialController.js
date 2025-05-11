const categoryService = require('../../services/category/categoryService');

/**
 * Lấy thể loại theo slug
 * @route GET /api/categories/slug/:slug
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getBySlug = async (req, res) => {
  try {
    const category = await categoryService.getCategoryBySlug(req.params.slug);
    return res.json(category);
  } catch (error) {
    console.error('Lỗi khi lấy thể loại theo slug:', error);
    
    if (error.message === 'Không tìm thấy thể loại') {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy thể loại' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ nội bộ' 
    });
  }
};

/**
 * Lấy tất cả thể loại đang hoạt động
 * @route GET /api/categories/active
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getActive = async (req, res) => {
  try {
    const { limit } = req.query;
    const categories = await categoryService.getActiveCategories(limit);
    return res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Lỗi khi lấy thể loại đang hoạt động:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ nội bộ' 
    });
  }
};