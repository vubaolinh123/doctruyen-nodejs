const categoryService = require('../../services/category/categoryService');

/**
 * Lấy danh sách tất cả thể loại
 * @route GET /api/categories
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAll = async (req, res) => {
  try {
    const { page, limit, sort, order, ...filters } = req.query;
    const result = await categoryService.getAllCategories({ page, limit, sort, order, ...filters });
    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thể loại:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ nội bộ' 
    });
  }
};

/**
 * Lấy thể loại theo ID
 * @route GET /api/categories/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getById = async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    return res.json(category);
  } catch (error) {
    console.error('Lỗi khi lấy thể loại theo ID:', error);
    
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
 * Tạo thể loại mới
 * @route POST /api/categories
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.create = async (req, res) => {
  try {
    const category = await categoryService.createCategory(req.body);
    return res.status(201).json(category);
  } catch (error) {
    console.error('Lỗi khi tạo thể loại:', error);
    
    if (error.message === 'Tên thể loại là bắt buộc') {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên thể loại là bắt buộc' 
      });
    }
    
    return res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Cập nhật thông tin thể loại
 * @route PUT /api/categories/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.update = async (req, res) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    return res.json(category);
  } catch (error) {
    console.error('Lỗi khi cập nhật thể loại:', error);
    
    if (error.message === 'Không tìm thấy thể loại') {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy thể loại' 
      });
    }
    
    return res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Xóa thể loại
 * @route DELETE /api/categories/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.remove = async (req, res) => {
  try {
    await categoryService.deleteCategory(req.params.id);
    return res.json({ 
      success: true, 
      message: 'Xóa thể loại thành công' 
    });
  } catch (error) {
    console.error('Lỗi khi xóa thể loại:', error);
    
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