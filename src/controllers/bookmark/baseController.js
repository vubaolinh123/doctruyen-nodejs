const bookmarkService = require('../../services/bookmark/bookmarkService');

/**
 * Lấy tất cả các bookmark
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAll = async (req, res) => {
  try {
    const { customer_id, story_id, page, limit, sort } = req.query;
    const items = await bookmarkService.getAllBookmarks({ 
      customer_id, 
      story_id, 
      page, 
      limit, 
      sort 
    });
    
    res.json({
      success: true,
      data: items
    });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách bookmark:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ nội bộ' 
    });
  }
};

/**
 * Lấy bookmark theo ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getById = async (req, res) => {
  try {
    const bookmark = await bookmarkService.getBookmarkById(req.params.id);
    
    res.json({
      success: true,
      data: bookmark
    });
  } catch (err) {
    console.error('Lỗi khi lấy bookmark theo ID:', err);
    
    if (err.message === 'Không tìm thấy bookmark') {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy bookmark' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ nội bộ' 
    });
  }
};

/**
 * Tạo bookmark mới
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.create = async (req, res) => {
  try {
    // Kiểm tra dữ liệu đầu vào
    const { story_id, chapter_id, customer_id } = req.body;
    
    if (!story_id || !chapter_id || !customer_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin bắt buộc: story_id, chapter_id, customer_id' 
      });
    }
    
    const bookmark = await bookmarkService.createBookmark(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Đã tạo bookmark thành công',
      data: bookmark
    });
  } catch (err) {
    console.error('Lỗi khi tạo bookmark:', err);
    
    // Xử lý lỗi trùng lặp (unique index)
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bookmark đã tồn tại cho người dùng và truyện này' 
      });
    }
    
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
};

/**
 * Cập nhật bookmark
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.update = async (req, res) => {
  try {
    const bookmark = await bookmarkService.updateBookmark(req.params.id, req.body);
    
    res.json({
      success: true,
      message: 'Cập nhật bookmark thành công',
      data: bookmark
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật bookmark:', err);
    
    if (err.message === 'Không tìm thấy bookmark') {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy bookmark' 
      });
    }
    
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
};

/**
 * Xóa bookmark
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.remove = async (req, res) => {
  try {
    await bookmarkService.deleteBookmark(req.params.id);
    
    res.json({
      success: true,
      message: 'Xóa bookmark thành công'
    });
  } catch (err) {
    console.error('Lỗi khi xóa bookmark:', err);
    
    if (err.message === 'Không tìm thấy bookmark') {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy bookmark' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ nội bộ' 
    });
  }
}; 