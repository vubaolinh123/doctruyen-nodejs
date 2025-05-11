const User = require('../../models/user');

/**
 * Service xử lý các tác vụ liên quan đến người dùng
 */
class UserService {
  /**
   * Lấy danh sách tất cả người dùng với lọc và phân trang
   * @param {Object} options - Các tùy chọn
   * @param {string} options.search - Từ khóa tìm kiếm
   * @param {string} options.role - Vai trò người dùng
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng trên mỗi trang
   * @param {string} options.sort - Trường sắp xếp
   * @returns {Object} Danh sách người dùng và thông tin phân trang
   */
  async getAllUsers({ search = '', role, page = 1, limit = 10, sort = '-createdAt' }) {
    try {
      const query = {};

      if (role) query.role = role;
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } }
        ];
      }

      // Chuyển đổi page và limit thành số
      const numPage = parseInt(page);
      const numLimit = parseInt(limit);
      
      // Lấy danh sách người dùng
      const users = await User.find(query)
        .sort(sort)
        .skip((numPage - 1) * numLimit)
        .limit(numLimit);
      
      // Đếm tổng số
      const total = await User.countDocuments(query);
      
      return {
        items: users,
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
   * Lấy thông tin người dùng theo ID
   * @param {string} id - ID người dùng
   * @returns {Object} Thông tin người dùng
   */
  async getUserById(id) {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error('Không tìm thấy người dùng');
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo người dùng mới
   * @param {Object} userData - Dữ liệu người dùng
   * @returns {Object} Người dùng đã tạo
   */
  async createUser(userData) {
    try {
      const user = new User(userData);
      await user.save();
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật thông tin người dùng
   * @param {string} id - ID người dùng
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} Người dùng đã cập nhật
   */
  async updateUser(id, updateData) {
    try {
      const user = await User.findByIdAndUpdate(id, updateData, { new: true });
      if (!user) {
        throw new Error('Không tìm thấy người dùng');
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa người dùng
   * @param {string} id - ID người dùng
   * @returns {boolean} Kết quả xóa
   */
  async deleteUser(id) {
    try {
      const user = await User.findByIdAndDelete(id);
      if (!user) {
        throw new Error('Không tìm thấy người dùng');
      }
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thông tin người dùng theo slug
   * @param {string} slug - Slug người dùng
   * @returns {Object} Thông tin người dùng
   */
  async getUserBySlug(slug) {
    try {
      const user = await User.findBySlug(slug);
      if (!user) {
        throw new Error('Không tìm thấy người dùng');
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lọc thông tin người dùng cho API public
   * @param {Object} user - Đối tượng người dùng
   * @returns {Object} Thông tin công khai của người dùng
   */
  filterPublicUserData(user) {
    if (!user) return null;

    // Chỉ trả về các thông tin công khai
    return {
      id: user._id,
      name: user.name,
      slug: user.slug,
      avatar: user.avatar,
      banner: user.banner,
      role: user.role,
      created_at: user.createdAt
    };
  }

  /**
   * Lọc thông tin người dùng cho chủ tài khoản
   * @param {Object} user - Đối tượng người dùng
   * @returns {Object} Thông tin đầy đủ cho chủ tài khoản
   */
  filterPrivateUserData(user) {
    if (!user) return null;

    // Trả về thông tin đầy đủ hơn cho chủ tài khoản
    return {
      id: user._id,
      name: user.name,
      slug: user.slug,
      email: user.email,
      avatar: user.avatar,
      banner: user.banner,
      gender: user.gender,
      birthday: user.birthday,
      role: user.role,
      accountType: user.accountType,
      coin: user.coin,
      coin_total: user.coin_total,
      coin_spent: user.coin_spent,
      attendance_summary: user.attendance_summary,
      created_at: user.createdAt
    };
  }
}

module.exports = new UserService(); 