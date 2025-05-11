const Bookmark = require('../../models/Bookmark');
const mongoose = require('mongoose');

/**
 * Service xử lý các tác vụ liên quan đến bookmark
 */
class BookmarkService {
  /**
   * Lấy danh sách tất cả bookmark với lọc
   * @param {Object} options - Các tùy chọn
   * @param {string} options.customer_id - ID của khách hàng (tùy chọn)
   * @param {string} options.story_id - ID của truyện (tùy chọn)
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng trên mỗi trang
   * @param {string} options.sort - Trường sắp xếp
   * @returns {Array} Danh sách bookmark
   */
  async getAllBookmarks({ customer_id, story_id, page = 1, limit = 10, sort = '-createdAt' }) {
    try {
      const query = {};
      if (customer_id) query.customer_id = customer_id;
      if (story_id) query.story_id = story_id;

      // Chuyển đổi page và limit sang số
      const numPage = parseInt(page);
      const numLimit = parseInt(limit);

      const items = await Bookmark.find(query)
        .sort(sort)
        .skip((numPage - 1) * numLimit)
        .limit(numLimit);
      
      return items;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy bookmark theo ID
   * @param {string} id - ID bookmark
   * @returns {Object} Thông tin bookmark
   */
  async getBookmarkById(id) {
    try {
      const bookmark = await Bookmark.findById(id);
      if (!bookmark) {
        throw new Error('Không tìm thấy bookmark');
      }
      return bookmark;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo bookmark mới
   * @param {Object} bookmarkData - Dữ liệu bookmark
   * @returns {Object} Bookmark đã tạo
   */
  async createBookmark(bookmarkData) {
    try {
      const bookmark = new Bookmark(bookmarkData);
      await bookmark.save();
      return bookmark;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật thông tin bookmark
   * @param {string} id - ID bookmark
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} Bookmark đã cập nhật
   */
  async updateBookmark(id, updateData) {
    try {
      const bookmark = await Bookmark.findByIdAndUpdate(id, updateData, { new: true });
      if (!bookmark) {
        throw new Error('Không tìm thấy bookmark');
      }
      return bookmark;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa bookmark
   * @param {string} id - ID bookmark
   * @returns {boolean} Kết quả xóa
   */
  async deleteBookmark(id) {
    try {
      const bookmark = await Bookmark.findByIdAndDelete(id);
      if (!bookmark) {
        throw new Error('Không tìm thấy bookmark');
      }
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy bookmark của người dùng
   * @param {string} customerId - ID người dùng
   * @param {number} limit - Giới hạn số lượng
   * @param {number} skip - Số bản ghi bỏ qua
   * @returns {Array} Danh sách bookmark
   */
  async getBookmarksByCustomer(customerId, limit = 10, skip = 0) {
    try {
      const bookmarks = await Bookmark.findByCustomer(customerId, limit, skip);
      return bookmarks;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy bookmark của người dùng cho truyện cụ thể
   * @param {string} customerId - ID người dùng
   * @param {string} storyId - ID truyện
   * @returns {Object} Thông tin bookmark
   */
  async getBookmarkByCustomerAndStory(customerId, storyId) {
    try {
      const bookmark = await Bookmark.findByCustomerAndStory(customerId, storyId);
      if (!bookmark) {
        throw new Error('Không tìm thấy bookmark');
      }
      return bookmark;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật hoặc tạo bookmark
   * @param {string} customerId - ID người dùng
   * @param {string} storyId - ID truyện
   * @param {string} chapterId - ID chapter
   * @param {string} note - Ghi chú (tùy chọn)
   * @returns {Object} Bookmark đã cập nhật hoặc tạo mới
   */
  async upsertBookmark(customerId, storyId, chapterId, note = '') {
    try {
      const bookmark = await Bookmark.upsertBookmark(customerId, storyId, chapterId, note);
      return bookmark;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new BookmarkService(); 