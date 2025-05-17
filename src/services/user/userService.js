const User = require('../../models/user');
const Transaction = require('../../models/transaction');

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

    // Lấy danh sách quyền đang hoạt động
    const activePermissions = user.getActivePermissions ? user.getActivePermissions() : [];

    // Lọc ra các quyền công khai (có thể hiển thị cho người khác)
    const publicPermissions = activePermissions.filter(p =>
      p.type === 'appearance' ||
      (p.metadata && p.metadata.public === true)
    );

    // Chỉ trả về các thông tin công khai
    return {
      id: user._id,
      name: user.name,
      slug: user.slug,
      avatar: user.avatar,
      banner: user.banner,
      role: user.role,
      permissions: publicPermissions,
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

    // Lấy danh sách quyền đang hoạt động
    const activePermissions = user.getActivePermissions ? user.getActivePermissions() : [];

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
      permissions: activePermissions,
      attendance_summary: user.attendance_summary,
      created_at: user.createdAt
    };
  }

  /**
   * Tìm kiếm người dùng
   * @param {string} term - Từ khóa tìm kiếm (email hoặc tên)
   * @returns {Array} Danh sách người dùng tìm thấy
   */
  async searchUsers(term) {
    // Nếu không có term, trả về mảng rỗng
    if (!term) {
      return [];
    }

    // Kiểm tra xem term có phải là email hay không
    const isEmail = term.includes('@');

    // Nếu term không phải là email và ngắn hơn 3 ký tự, không tìm kiếm
    if (!isEmail && term.length < 3) {
      return [];
    }

    // Query điều kiện tìm kiếm
    let searchQuery;

    if (isEmail) {
      // Nếu là email, tìm chính xác hoặc tương tự
      searchQuery = {
        $or: [
          { email: term }, // Tìm chính xác email
          { email: { $regex: term, $options: 'i' } } // Tìm email có chứa term
        ]
      };
    } else {
      // Nếu không phải email, tìm theo tên hoặc email chứa term
      searchQuery = {
        $or: [
          { email: { $regex: term, $options: 'i' } },
          { name: { $regex: term, $options: 'i' } }
        ]
      };
    }

    // Tìm kiếm người dùng theo điều kiện
    return User.find(searchQuery)
      .select('_id name email avatar coin coin_total coin_spent')
      .limit(10);
  }

  /**
   * Lấy thông tin xu của người dùng
   * @param {string} userId - ID người dùng
   * @returns {Object} Thông tin xu của người dùng
   */
  async getUserCoinInfo(userId) {
    // Tìm người dùng
    const user = await User.findById(userId)
      .select('_id name email avatar coin coin_total coin_spent coin_stats');

    if (!user) {
      throw new Error('User not found');
    }

    // Cập nhật thống kê xu nếu cần
    if (!user.coin_stats || !user.coin_stats.last_updated ||
        new Date() - new Date(user.coin_stats.last_updated) > 24 * 60 * 60 * 1000) {
      // Cập nhật thời gian cập nhật cuối cùng
      user.coin_stats = user.coin_stats || {};
      user.coin_stats.last_updated = new Date();
      await user.save();
    }

    return user;
  }
}

module.exports = new UserService();