const Author = require('../../models/author');
const User = require('../../models/user');
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
   * @param {boolean} options.all - Lấy tất cả không phân trang
   * @param {string} options.fields - Các fields cần trả về
   * @param {string} options.search - Tìm kiếm theo tên
   * @param {string} options.ids - Danh sách IDs cách nhau bởi dấu phẩy
   * @param {Object} options.filters - Các điều kiện lọc
   * @returns {Object} Danh sách tác giả và thông tin phân trang
   */
  async getAllAuthors({ page = 1, limit = 10, all = false, fields = '', search = '', ids = '', ...filters }) {
    try {
      const query = {};

      // Lọc theo trạng thái nếu có
      if (filters.status !== undefined) {
        query.status = filters.status === 'true';
      }

      // Lọc theo tên nếu có (search parameter)
      if (search) {
        query.name = { $regex: search, $options: 'i' };
      }

      // Lọc theo tên nếu có (name parameter - backward compatibility)
      if (filters.name) {
        query.name = { $regex: filters.name, $options: 'i' };
      }

      // Lọc theo slug nếu có
      if (filters.slug) {
        query.slug = filters.slug;
      }

      // Lọc theo loại tác giả nếu có
      if (filters.authorType && filters.authorType !== '') {
        query.authorType = filters.authorType;
      }

      // Lọc theo trạng thái phê duyệt (chỉ áp dụng cho system authors)
      if (filters.approvalStatus && filters.approvalStatus !== '') {
        query.authorType = 'system'; // Chỉ áp dụng cho system authors
        query.approvalStatus = filters.approvalStatus;
      }

      // Lọc theo danh sách IDs nếu có
      if (ids) {
        const idArray = ids.split(',').map(id => id.trim()).filter(id => id);
        if (idArray.length > 0) {
          query._id = { $in: idArray };
        }
      }

      // Xử lý fields selection
      let selectFields = '';
      if (fields) {
        selectFields = fields.split(',').join(' ');
      }

      // Tạo query builder
      let queryBuilder = Author.find(query);

      // Populate user information
      queryBuilder = queryBuilder.populate({
        path: 'userId',
        select: 'name avatar email coins',
        model: 'User'
      });

      // Populate reviewer information
      queryBuilder = queryBuilder.populate({
        path: 'reviewedBy',
        select: 'name email',
        model: 'User'
      });

      // Áp dụng field selection nếu có
      if (selectFields) {
        queryBuilder = queryBuilder.select(selectFields);
      }

      // Nếu all=true, lấy tất cả không phân trang
      if (all === 'true' || all === true) {
        const items = await queryBuilder
          .sort({ createdAt: -1 })
          .lean(); // Sử dụng lean() để tăng hiệu suất

        return {
          success: true,
          message: 'Lấy tất cả tác giả thành công',
          data: {
            authors: items,
            pagination: {
              total: items.length,
              totalPages: 1,
              page: 1,
              limit: items.length
            }
          }
        };
      }

      // Chuyển đổi trang và limit thành số
      const numPage = parseInt(page);
      const numLimit = parseInt(limit);

      const items = await queryBuilder
        .sort({ createdAt: -1 })
        .skip((numPage - 1) * numLimit)
        .limit(numLimit);

      // Đếm tổng số
      const total = await Author.countDocuments(query);

      return {
        success: true,
        message: 'Lấy danh sách tác giả thành công',
        data: {
          authors: items,
          pagination: {
            total,
            totalPages: Math.ceil(total / numLimit),
            page: numPage,
            limit: numLimit
          }
        }
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
   * @param {string} authorData.authorType - Loại tác giả ('external' hoặc 'system')
   * @param {string} authorData.userId - ID của user (chỉ cho system author)
   * @returns {Object} Tác giả đã tạo
   */
  async createAuthor(authorData) {
    try {
      const { name, slug, status, authorType, userId } = authorData;

      // Kiểm tra nếu tên không được cung cấp
      if (!name) {
        throw new Error('Tên tác giả là bắt buộc');
      }

      // Kiểm tra authorType hợp lệ
      if (authorType && !['external', 'system'].includes(authorType)) {
        throw new Error('authorType phải là "external" hoặc "system"');
      }

      // Kiểm tra logic userId và authorType
      if (authorType === 'system' && !userId) {
        throw new Error('userId là bắt buộc khi authorType là "system"');
      }

      if (authorType === 'external' && userId) {
        throw new Error('userId không được phép khi authorType là "external"');
      }

      // Kiểm tra xem user đã có author record chưa (nếu là system author)
      if (authorType === 'system' && userId) {
        const existingAuthor = await Author.userHasAuthorRecord(userId);
        if (existingAuthor) {
          throw new Error('User này đã có author record');
        }
      }

      // Chuẩn bị dữ liệu
      const newAuthorData = {
        name,
        status: status !== undefined ? Boolean(status) : true,
        authorType: authorType || 'external',
        userId: authorType === 'system' ? userId : null
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

      // Không cho phép cập nhật authorType và userId sau khi tạo
      // Điều này đảm bảo tính nhất quán của dữ liệu
      if (updateData.authorType !== undefined) {
        throw new Error('Không thể thay đổi authorType sau khi tạo');
      }
      if (updateData.userId !== undefined) {
        throw new Error('Không thể thay đổi userId sau khi tạo');
      }

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
      // Tìm tác giả trước khi xóa để lấy thông tin userId
      const author = await Author.findById(id);

      if (!author) {
        throw new Error('Không tìm thấy tác giả');
      }

      // Nếu tác giả có userId (system author), cập nhật role của user về 'user'
      if (author.userId && author.authorType === 'system') {
        try {
          // Update user role back to 'user'
          await User.findByIdAndUpdate(author.userId, {
            role: 'user'
          });

          console.log(`[AuthorService] Reset user role to 'user' for userId: ${author.userId}`);
        } catch (error) {
          console.error(`[AuthorService] Error updating user role:`, error);
        }
      }

      // Xóa tác giả
      await Author.findByIdAndDelete(id);

      return true;
    } catch (error) {
      console.error('Error in deleteAuthor:', error);
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

  /**
   * Tạo system author từ user ID
   * @param {string} userId - ID của user
   * @param {string} authorName - Tên tác giả (tùy chọn, sẽ dùng tên user nếu không có)
   * @returns {Object} Tác giả đã tạo
   */
  async createSystemAuthor(userId, authorName = null) {
    try {
      // Kiểm tra xem user có tồn tại không
      const User = require('../../models/user');
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Không tìm thấy user');
      }

      // Kiểm tra xem user đã có author record chưa
      const existingAuthor = await Author.userHasAuthorRecord(userId);
      if (existingAuthor) {
        throw new Error('User này đã có author record');
      }

      // Sử dụng tên user nếu không có authorName
      const name = authorName || user.name;

      const authorData = {
        name,
        authorType: 'system',
        userId,
        status: true
      };

      return await this.createAuthor(authorData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy author theo user ID
   * @param {string} userId - ID của user
   * @returns {Object|null} Thông tin tác giả hoặc null
   */
  async getAuthorByUserId(userId) {
    try {
      const author = await Author.findByUserId(userId);
      return author;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Kiểm tra xem user có phải là author không
   * @param {string} userId - ID của user
   * @returns {boolean} true nếu user là author
   */
  async isUserAuthor(userId) {
    try {
      const author = await Author.userHasAuthorRecord(userId);
      return author;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthorService();