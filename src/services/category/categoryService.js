const Category = require('../../models/Category');
const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * Service xử lý các tác vụ liên quan đến thể loại
 */
class CategoryService {
  /**
   * Lấy danh sách tất cả thể loại với phân trang và lọc
   * @param {Object} options - Các tùy chọn
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng trên mỗi trang
   * @param {string} options.sort - Trường để sắp xếp
   * @param {string} options.order - Thứ tự sắp xếp (asc hoặc desc)
   * @param {Object} options.filters - Các điều kiện lọc
   * @returns {Object} Danh sách thể loại và thông tin phân trang
   */
  async getAllCategories({ page = 1, limit = 10, sort = 'createdAt', order = 'desc', ...filters }) {
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

      // Lấy tất cả thể loại phù hợp
      let items = await Category.find(query).populate('stories');

      // Format response và thêm comicCount
      const formattedItems = items.map(item => {
        const itemObj = item.toObject();
        itemObj.comicCount = item.stories || 0;
        delete itemObj.stories;
        return itemObj;
      });
      
      // Sắp xếp theo trường đã chỉ định
      if (sort === 'comicCount') {
        // Sắp xếp theo số lượng truyện
        formattedItems.sort((a, b) => {
          const countA = a.comicCount || 0;
          const countB = b.comicCount || 0;
          return order === 'asc' ? countA - countB : countB - countA;
        });
      } else {
        // Sắp xếp tiêu chuẩn theo các trường khác
        const sortOrder = order === 'asc' ? 1 : -1;
        const sortField = sort;

        formattedItems.sort((a, b) => {
          if (a[sortField] < b[sortField]) return -1 * sortOrder;
          if (a[sortField] > b[sortField]) return 1 * sortOrder;
          return 0;
        });
      }
      
      // Đếm tổng số
      const total = formattedItems.length;
      
      // Chuyển đổi page và limit sang số
      const numPage = parseInt(page);
      const numLimit = parseInt(limit);
      
      // Áp dụng phân trang sau khi sắp xếp
      const startIndex = (numPage - 1) * numLimit;
      const endIndex = startIndex + numLimit;
      const paginatedItems = formattedItems.slice(startIndex, endIndex);
      
      return {
        items: paginatedItems,
        total,
        totalPages: Math.ceil(total / numLimit),
        currentPage: numPage,
        limit: numLimit
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thể loại theo ID
   * @param {string} id - ID thể loại
   * @returns {Object} Thông tin thể loại
   */
  async getCategoryById(id) {
    try {
      const category = await Category.findById(id).populate('stories');
      
      if (!category) {
        throw new Error('Không tìm thấy thể loại');
      }
      
      const response = category.toObject();
      response.comicCount = category.stories || 0;
      delete response.stories;
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thể loại theo slug
   * @param {string} slug - Slug thể loại
   * @returns {Object} Thông tin thể loại
   */
  async getCategoryBySlug(slug) {
    try {
      const category = await Category.findOne({ 
        slug: slug,
        status: true
      }).populate('stories');
      
      if (!category) {
        throw new Error('Không tìm thấy thể loại');
      }
      
      const response = category.toObject();
      response.comicCount = category.stories || 0;
      delete response.stories;
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo thể loại mới
   * @param {Object} categoryData - Dữ liệu thể loại
   * @param {string} categoryData.name - Tên thể loại
   * @param {string} categoryData.slug - Slug thể loại (tùy chọn)
   * @param {string} categoryData.description - Mô tả thể loại (tùy chọn)
   * @param {boolean} categoryData.status - Trạng thái thể loại (tùy chọn)
   * @returns {Object} Thể loại đã tạo
   */
  async createCategory(categoryData) {
    try {
      const { name, slug, description, status } = categoryData;
      
      // Kiểm tra nếu tên không được cung cấp
      if (!name) {
        throw new Error('Tên thể loại là bắt buộc');
      }
      
      // Chuẩn bị dữ liệu
      const newCategoryData = {
        name,
        description: description || '',
        status: status !== undefined ? Boolean(status) : true
      };
      
      // Thêm slug nếu được cung cấp, ngược lại sẽ tự động tạo
      if (slug) {
        newCategoryData.slug = slug;
      }
      
      const category = new Category(newCategoryData);
      await category.save();
      
      // Lấy số lượng truyện
      await category.populate('stories');
      const response = category.toObject();
      response.comicCount = category.stories || 0;
      delete response.stories;
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật thông tin thể loại
   * @param {string} id - ID thể loại
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} Thể loại đã cập nhật
   */
  async updateCategory(id, updateData) {
    try {
      const dataToUpdate = {};
      
      // Chỉ cập nhật các trường được cung cấp trong request
      if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
      if (updateData.slug !== undefined) dataToUpdate.slug = updateData.slug;
      if (updateData.description !== undefined) dataToUpdate.description = updateData.description;
      if (updateData.status !== undefined) dataToUpdate.status = Boolean(updateData.status);
      
      // Nếu tên được cập nhật nhưng slug không được cung cấp, tạo lại slug
      if (updateData.name && updateData.slug === undefined) {
        dataToUpdate.slug = slugify(updateData.name, {
          lower: true,
          strict: true,
          locale: 'vi'
        });
      }
      
      const category = await Category.findByIdAndUpdate(
        id, 
        dataToUpdate, 
        { new: true }
      ).populate('stories');
      
      if (!category) {
        throw new Error('Không tìm thấy thể loại');
      }
      
      const response = category.toObject();
      response.comicCount = category.stories || 0;
      delete response.stories;
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa thể loại
   * @param {string} id - ID thể loại
   * @returns {boolean} Kết quả xóa
   */
  async deleteCategory(id) {
    try {
      const category = await Category.findByIdAndDelete(id);
      
      if (!category) {
        throw new Error('Không tìm thấy thể loại');
      }
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy danh sách thể loại đang hoạt động
   * @param {number} limit - Giới hạn số lượng
   * @returns {Array} Danh sách thể loại
   */
  async getActiveCategories(limit = 100) {
    try {
      const categories = await Category.findActive(parseInt(limit)).populate('stories');
      
      const formattedCategories = categories.map(category => {
        const catObj = category.toObject();
        catObj.comicCount = category.stories || 0;
        delete catObj.stories;
        return catObj;
      });
      
      return formattedCategories;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new CategoryService(); 