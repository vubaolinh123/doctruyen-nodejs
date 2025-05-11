const Author = require('../../models/Author');
const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * Service xử lý các tác vụ liên quan đến tác giả
 */
class AuthorService {
  /**
   * Lấy danh sách tất cả tác giả với phân trang và lọc
   * @param {Object} options - Các tùy chọn
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng trên mỗi trang
   * @param {Object} options.filters - Các điều kiện lọc
   * @returns {Object} Danh sách tác giả và thông tin phân trang
   */
  async getAllAuthors({ page = 1, limit = 10, ...filters }) {
    try {
      const query = {};
      
      // Lọc theo trạng thái nếu có
      if (filters.status !== undefined) {
        query.status = filters.status === 'true';
      }
      
      // Lọc theo tên nếu có
      if (filters.name) {
        query.name = { $regex: filters.name, $options: 'i' };
      }
      
      // Lọc theo slug nếu có
      if (filters.slug) {
        query.slug = filters.slug;
      }

      // Chuyển đổi trang và limit thành số
      const numPage = parseInt(page);
      const numLimit = parseInt(limit);

      const items = await Author.find(query)
        .sort({ createdAt: -1 })
        .skip((numPage - 1) * numLimit)
        .limit(numLimit);

      // Đếm tổng số
      const total = await Author.countDocuments(query);
      
      return {
        items,
        total,
        totalPages: Math.ceil(total / numLimit),
        currentPage: numPage
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy tác giả theo ID
   * @param {string} id - ID tác giả
   * @returns {Object} Thông tin tác giả
   */
  async getAuthorById(id) {
    try {
      const author = await Author.findById(id);
      if (!author) {
        throw new Error('Không tìm thấy tác giả');
      }
      return author;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy tác giả theo slug
   * @param {string} slug - Slug tác giả
   * @returns {Object} Thông tin tác giả
   */
  async getAuthorBySlug(slug) {
    try {
      const author = await Author.findBySlug(slug);
      if (!author) {
        throw new Error('Không tìm thấy tác giả');
      }
      return author;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo tác giả mới
   * @param {Object} authorData - Dữ liệu tác giả
   * @param {string} authorData.name - Tên tác giả
   * @param {string} authorData.slug - Slug tác giả (tùy chọn)
   * @param {boolean} authorData.status - Trạng thái tác giả (tùy chọn)
   * @returns {Object} Tác giả đã tạo
   */
  async createAuthor(authorData) {
    try {
      const { name, slug, status } = authorData;
      
      // Kiểm tra nếu tên không được cung cấp
      if (!name) {
        throw new Error('Tên tác giả là bắt buộc');
      }
      
      // Chuẩn bị dữ liệu
      const newAuthorData = {
        name,
        status: status !== undefined ? Boolean(status) : true
      };
      
      // Thêm slug nếu được cung cấp, ngược lại sẽ tự động tạo
      if (slug) {
        newAuthorData.slug = slug;
      }
      
      const author = new Author(newAuthorData);
      await author.save();
      
      return author;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật thông tin tác giả
   * @param {string} id - ID tác giả
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} Tác giả đã cập nhật
   */
  async updateAuthor(id, updateData) {
    try {
      const dataToUpdate = {};
      
      // Chỉ cập nhật các trường được cung cấp trong request
      if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
      if (updateData.slug !== undefined) dataToUpdate.slug = updateData.slug;
      if (updateData.status !== undefined) dataToUpdate.status = Boolean(updateData.status);
      
      // Nếu tên được cập nhật nhưng slug không được cung cấp, tạo lại slug
      if (updateData.name && updateData.slug === undefined) {
        dataToUpdate.slug = slugify(updateData.name, {
          lower: true,
          strict: true,
          locale: 'vi'
        });
      }
      
      const author = await Author.findByIdAndUpdate(
        id, 
        dataToUpdate, 
        { new: true }
      );
      
      if (!author) {
        throw new Error('Không tìm thấy tác giả');
      }
      
      return author;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa tác giả
   * @param {string} id - ID tác giả
   * @returns {boolean} Kết quả xóa
   */
  async deleteAuthor(id) {
    try {
      const author = await Author.findByIdAndDelete(id);
      
      if (!author) {
        throw new Error('Không tìm thấy tác giả');
      }
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy danh sách tác giả đang hoạt động
   * @param {number} limit - Giới hạn số lượng
   * @returns {Array} Danh sách tác giả
   */
  async getActiveAuthors(limit = 100) {
    try {
      const authors = await Author.findActive(parseInt(limit));
      return authors;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthorService(); 