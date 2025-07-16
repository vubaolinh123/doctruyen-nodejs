const authorService = require('../../services/author/authorService');

/**
 * Lấy danh sách tất cả tác giả
 * @route GET /api/authors
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAll = async (req, res) => {
  try {
    const { page, limit, all, fields, search, ids, ...filters } = req.query;

    const result = await authorService.getAllAuthors({
      page,
      limit,
      all,
      fields,
      search,
      ids,
      ...filters
    });

    return res.json(result);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tác giả:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy tác giả theo ID
 * @route GET /api/authors/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getById = async (req, res) => {
  try {
    const author = await authorService.getAuthorById(req.params.id);
    return res.json({
      success: true,
      message: 'Lấy thông tin tác giả thành công',
      data: author
    });
  } catch (error) {
    console.error('Lỗi khi lấy tác giả theo ID:', error);

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
 * Tạo tác giả mới
 * @route POST /api/authors
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.create = async (req, res) => {
  try {
    const author = await authorService.createAuthor(req.body);
    return res.status(201).json({
      success: true,
      message: 'Tạo tác giả thành công',
      data: author
    });
  } catch (error) {
    console.error('Lỗi khi tạo tác giả:', error);
    
    if (error.message === 'Tên tác giả là bắt buộc') {
      return res.status(400).json({ 
        success: false, 
        message: 'Tên tác giả là bắt buộc' 
      });
    }
    
    return res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Cập nhật thông tin tác giả
 * @route PUT /api/authors/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.update = async (req, res) => {
  try {
    const author = await authorService.updateAuthor(req.params.id, req.body);
    return res.json({
      success: true,
      message: 'Cập nhật tác giả thành công',
      data: author
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật tác giả:', error);
    
    if (error.message === 'Không tìm thấy tác giả') {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy tác giả' 
      });
    }
    
    return res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Xóa tác giả
 * @route DELETE /api/authors/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.remove = async (req, res) => {
  try {
    await authorService.deleteAuthor(req.params.id);
    return res.json({ 
      success: true, 
      message: 'Xóa tác giả thành công' 
    });
  } catch (error) {
    console.error('Lỗi khi xóa tác giả:', error);
    
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