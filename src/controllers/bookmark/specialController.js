const bookmarkService = require('../../services/bookmark/bookmarkService');
const Bookmark = require('../../models/bookmark');

/**
 * Lấy bookmark của người dùng
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getBookmarksByCustomer = async (req, res) => {
  try {
    const { limit = 10, skip = 0 } = req.query;
    const customerId = req.params.customerId || req.user.id;

    // Chuyển đổi limit và skip sang số
    const numLimit = parseInt(limit);
    const numSkip = parseInt(skip);

    const bookmarks = await bookmarkService.getBookmarksByCustomer(
      customerId,
      numLimit,
      numSkip
    );

    res.json({
      success: true,
      data: bookmarks
    });
  } catch (err) {
    console.error('Lỗi khi lấy bookmark của người dùng:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy bookmark của người dùng cho truyện cụ thể
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getBookmarkByCustomerAndStory = async (req, res) => {
  try {
    const { customerId, storyId } = req.params;

    const bookmark = await bookmarkService.getBookmarkByCustomerAndStory(
      customerId,
      storyId
    );

    res.json({
      success: true,
      data: bookmark
    });
  } catch (err) {
    console.error('Lỗi khi lấy bookmark của người dùng cho truyện:', err);

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
 * Cập nhật hoặc tạo mới bookmark
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.upsertBookmark = async (req, res) => {
  try {
    const { storyId, chapterId, note } = req.body;
    const customerId = req.user.id;

    // Kiểm tra dữ liệu đầu vào
    if (!storyId || !chapterId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: storyId, chapterId'
      });
    }

    const bookmark = await bookmarkService.upsertBookmark(
      customerId,
      storyId,
      chapterId,
      note || ''
    );

    res.json({
      success: true,
      message: 'Đã cập nhật/tạo mới bookmark thành công',
      data: bookmark
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật/tạo mới bookmark:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * Xóa tất cả bookmark của người dùng
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.removeAllBookmarksByCustomer = async (req, res) => {
  try {
    const customerId = req.params.customerId || req.user.id;

    // Xóa tất cả bookmark của người dùng
    await Bookmark.deleteMany({ customer_id: customerId });

    res.json({
      success: true,
      message: 'Đã xóa tất cả bookmark của người dùng thành công'
    });
  } catch (err) {
    console.error('Lỗi khi xóa tất cả bookmark của người dùng:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};