const mongoose = require('mongoose');
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
   * Tìm người dùng theo ID với các tùy chọn
   * @param {string} id - ID người dùng
   * @param {Object} options - Các tùy chọn (select, populate)
   * @returns {Object} Thông tin người dùng
   */
  async findById(id, options = {}) {
    try {
      let query = User.findById(id);

      if (options.select) {
        query = query.select(options.select);
      }

      if (options.populate) {
        query = query.populate(options.populate);
      }

      return await query;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  /**
   * Tìm người dùng theo email
   * @param {string} email - Email người dùng
   * @param {Object} options - Các tùy chọn (select, populate)
   * @returns {Object} Thông tin người dùng
   */
  async findByEmail(email, options = {}) {
    try {
      let query = User.findOne({ email });

      if (options.select) {
        query = query.select(options.select);
      }

      if (options.populate) {
        query = query.populate(options.populate);
      }

      return await query;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  /**
   * Tìm người dùng theo Google ID (thực tế là tìm bằng email)
   * @param {string} googleId - Google ID hoặc email người dùng
   * @param {Object} options - Các tùy chọn (select, populate)
   * @returns {Object} Thông tin người dùng
   */
  async findByGoogleId(googleId, options = {}) {
    try {
      console.log(`[userService] Finding user with Google account: ${googleId}`);

      // Kiểm tra xem googleId có phải là email không
      if (googleId && googleId.includes('@')) {
        // Nếu là email, tìm người dùng bằng email
        console.log(`[userService] Input is an email, searching by email: ${googleId}`);
        return await this.findByEmail(googleId, options);
      }

      // Nếu không phải email và không có thông tin khác, trả về null
      console.log(`[userService] Input is not an email and we don't store Google IDs, returning null`);
      return null;
    } catch (error) {
      console.error('[userService] Error finding user by Google ID:', error);
      return null;
    }
  }

  /**
   * Tìm người dùng theo slug
   * @param {string} slug - Slug người dùng
   * @param {Object} options - Các tùy chọn (select, populate)
   * @returns {Object} Thông tin người dùng
   */
  async findBySlug(slug, options = {}) {
    try {
      let query = User.findOne({ slug });

      if (options.select) {
        query = query.select(options.select);
      }

      if (options.populate) {
        query = query.populate(options.populate);
      }

      return await query;
    } catch (error) {
      console.error('Error finding user by slug:', error);
      return null;
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
   * Xóa người dùng với cascade deletion cho tất cả dữ liệu liên quan
   * @param {string} id - ID người dùng
   * @returns {boolean} Kết quả xóa
   */
  async deleteUser(id) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Kiểm tra user tồn tại
        const user = await User.findById(id).session(session);
        if (!user) {
          throw new Error('Không tìm thấy người dùng');
        }

        console.log(`[UserService] Bắt đầu xóa user ${id} và tất cả dữ liệu liên quan`);

        // Import các models cần thiết
        const Bookmark = require('../../models/bookmark');
        const StoriesReading = require('../../models/storiesReading');
        const Comment = require('../../models/comment');
        const UserRating = require('../../models/userRating');
        const Attendance = require('../../models/attendance');
        const UserAttendanceReward = require('../../models/userAttendanceReward');
        const UserPermission = require('../../models/userPermission');

        // 1. Xóa bookmarks
        const bookmarkResult = await Bookmark.deleteMany({ user_id: id }).session(session);
        console.log(`[UserService] Đã xóa ${bookmarkResult.deletedCount} bookmarks`);

        // 2. Xóa reading history
        const readingResult = await StoriesReading.deleteMany({ user_id: id }).session(session);
        console.log(`[UserService] Đã xóa ${readingResult.deletedCount} reading history records`);

        // 3. Xóa comments và cập nhật liked_by arrays
        const commentResult = await Comment.deleteMany({ user_id: id }).session(session);
        console.log(`[UserService] Đã xóa ${commentResult.deletedCount} comments`);

        // Xóa user khỏi liked_by arrays trong comments khác
        const likedCommentsResult = await Comment.updateMany(
          { 'engagement.liked_by': id },
          { $pull: { 'engagement.liked_by': id } }
        ).session(session);
        console.log(`[UserService] Đã xóa user khỏi ${likedCommentsResult.modifiedCount} liked comments`);

        // 4. Xóa ratings
        const ratingResult = await UserRating.deleteMany({ user_id: id }).session(session);
        console.log(`[UserService] Đã xóa ${ratingResult.deletedCount} ratings`);

        // 5. Xóa attendance records
        const attendanceResult = await Attendance.deleteMany({ user_id: id }).session(session);
        console.log(`[UserService] Đã xóa ${attendanceResult.deletedCount} attendance records`);

        // 6. Xóa attendance rewards
        const attendanceRewardResult = await UserAttendanceReward.deleteMany({ user_id: id }).session(session);
        console.log(`[UserService] Đã xóa ${attendanceRewardResult.deletedCount} attendance rewards`);

        // 7. Xóa user permissions
        const permissionResult = await UserPermission.deleteMany({ user_id: id }).session(session);
        console.log(`[UserService] Đã xóa ${permissionResult.deletedCount} user permissions`);

        // 8. Xóa các dữ liệu khác nếu có (transactions, purchased stories, etc.)
        try {
          const Transaction = require('../../models/transaction');
          const transactionResult = await Transaction.deleteMany({ user_id: id }).session(session);
          console.log(`[UserService] Đã xóa ${transactionResult.deletedCount} transactions`);
        } catch (err) {
          console.log(`[UserService] Transaction model không tồn tại hoặc lỗi: ${err.message}`);
        }

        try {
          const PurchasedStory = require('../../models/purchasedStory');
          const purchasedResult = await PurchasedStory.deleteMany({ user_id: id }).session(session);
          console.log(`[UserService] Đã xóa ${purchasedResult.deletedCount} purchased stories`);
        } catch (err) {
          console.log(`[UserService] PurchasedStory model không tồn tại hoặc lỗi: ${err.message}`);
        }

        // 9. Cuối cùng xóa user
        await User.findByIdAndDelete(id).session(session);
        console.log(`[UserService] Đã xóa user ${id} thành công`);

        // Log tổng kết
        console.log(`[UserService] Hoàn thành xóa user ${id} và tất cả dữ liệu liên quan:
          - Bookmarks: ${bookmarkResult.deletedCount}
          - Reading History: ${readingResult.deletedCount}
          - Comments: ${commentResult.deletedCount}
          - Liked Comments Updated: ${likedCommentsResult.modifiedCount}
          - Ratings: ${ratingResult.deletedCount}
          - Attendance: ${attendanceResult.deletedCount}
          - Attendance Rewards: ${attendanceRewardResult.deletedCount}
          - Permissions: ${permissionResult.deletedCount}`);
      });

      return true;
    } catch (error) {
      console.error(`[UserService] Lỗi khi xóa user ${id}:`, error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Lấy thông tin người dùng theo slug
   * @param {string} slug - Slug người dùng
   * @returns {Object} Thông tin người dùng
   */
  async getUserBySlug(slug) {
    try {
      console.log(`[UserService] Looking for user with slug: ${slug}`);
      const user = await this.findBySlug(slug);
      console.log(`[UserService] User found: ${user ? user.name : 'null'}`);
      if (!user) {
        console.log(`[UserService] No user found with slug: ${slug}`);
        throw new Error('Không tìm thấy người dùng');
      }
      return user;
    } catch (error) {
      console.error(`[UserService] Error in getUserBySlug for slug '${slug}':`, error.message);
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

    // Lấy danh sách quyền đang hoạt động với kiểm tra an toàn
    let activePermissions = [];
    try {
      if (user.getActivePermissions && typeof user.getActivePermissions === 'function') {
        const permissions = user.getActivePermissions();
        activePermissions = Array.isArray(permissions) ? permissions : [];
      }
    } catch (error) {
      console.warn('Error getting active permissions:', error);
      activePermissions = [];
    }

    // Lọc ra các quyền công khai (có thể hiển thị cho người khác)
    const publicPermissions = activePermissions.filter(p =>
      p && (p.type === 'appearance' || (p.metadata && p.metadata.public === true))
    );

    // Chỉ trả về các thông tin công khai với nested social object
    return {
      id: user._id,
      name: user.name,
      slug: user.slug,
      avatar: user.avatar,
      email: user.email,
      banner: user.banner,
      isActive: user.isActive,
      role: user.role,
      accountType: user.accountType,
      gender: user.gender,
      diem_danh: user.diem_danh || 0,
      // Nested social object structure
      social: {
        bio: user.social?.bio || '',
        facebook: user.social?.facebook || '',
        twitter: user.social?.twitter || '',
        instagram: user.social?.instagram || '',
        youtube: user.social?.youtube || '',
        website: user.social?.website || ''
      },
      coin: user.coin || 0,
      coin_total: user.coin_total || 0,
      coin_spent: user.coin_spent || 0,
      permissions: publicPermissions,
      created_at: user.createdAt,
      isActive: user.isActive,
      // Attendance summary
      attendance_summary: user.attendance_summary || {
        total_days: user.diem_danh || 0,
        current_streak: 0,
        longest_streak: 0,
        last_attendance: null
      },
      // Metadata
      metadata: user.metadata || {
        comment_count: 0,
        liked_comments_count: 0
      }
    };
  }

  /**
   * Lọc thông tin người dùng cho chủ tài khoản
   * @param {Object} user - Đối tượng người dùng
   * @returns {Object} Thông tin đầy đủ cho chủ tài khoản
   */
  filterPrivateUserData(user) {
    if (!user) return null;

    // Lấy danh sách quyền đang hoạt động với kiểm tra an toàn
    let activePermissions = [];
    try {
      if (user.getActivePermissions && typeof user.getActivePermissions === 'function') {
        const permissions = user.getActivePermissions();
        activePermissions = Array.isArray(permissions) ? permissions : [];
      }
    } catch (error) {
      console.warn('Error getting active permissions:', error);
      activePermissions = [];
    }

    // Trả về thông tin đầy đủ hơn cho chủ tài khoản với nested social object
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
      diem_danh: user.diem_danh || 0,
      // Nested social object structure
      social: {
        bio: user.social?.bio || '',
        facebook: user.social?.facebook || '',
        twitter: user.social?.twitter || '',
        instagram: user.social?.instagram || '',
        youtube: user.social?.youtube || '',
        website: user.social?.website || ''
      },
      permissions: activePermissions,
      attendance_summary: user.attendance_summary || {
        total_days: user.diem_danh || 0,
        current_streak: 0,
        longest_streak: 0,
        last_attendance: null
      },
      created_at: user.createdAt,
      isActive: user.isActive,
      email_verified_at: user.email_verified_at,
      status: user.status,
      // Metadata
      metadata: user.metadata || {
        comment_count: 0,
        liked_comments_count: 0
      }
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

  /**
   * Lấy thống kê người dùng cho admin
   * @returns {Object} Thống kê người dùng
   */
  async getUserStats() {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Thống kê tổng quan
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ status: 'active' });
      const inactiveUsers = await User.countDocuments({ status: 'inactive' });
      const bannedUsers = await User.countDocuments({ status: 'banned' });

      // Thống kê người dùng mới
      const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });
      const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: thisWeek } });
      const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: thisMonth } });

      // Thống kê theo vai trò
      const usersByRole = await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);

      const roleStats = {
        user: 0,
        author: 0,
        admin: 0
      };

      usersByRole.forEach(item => {
        if (item._id && roleStats.hasOwnProperty(item._id)) {
          roleStats[item._id] = item.count;
        }
      });

      // Thống kê theo loại tài khoản
      const usersByAccountType = await User.aggregate([
        { $group: { _id: '$accountType', count: { $sum: 1 } } }
      ]);

      const accountTypeStats = {
        email: 0,
        google: 0
      };

      usersByAccountType.forEach(item => {
        if (item._id && accountTypeStats.hasOwnProperty(item._id)) {
          accountTypeStats[item._id] = item.count;
        }
      });

      // Thống kê coin
      const coinStats = await User.aggregate([
        {
          $group: {
            _id: null,
            totalCoins: { $sum: '$coin' },
            averageCoins: { $avg: '$coin' }
          }
        }
      ]);

      const totalCoinsInSystem = coinStats[0]?.totalCoins || 0;
      const averageCoinsPerUser = coinStats[0]?.averageCoins || 0;

      // Người dùng hoạt động nhất (theo last_active)
      const mostActiveUsers = await User.find({ last_active: { $exists: true } })
        .sort({ last_active: -1 })
        .limit(5)
        .select('name email avatar last_active coin role');

      // Đăng ký gần đây
      const recentRegistrations = await User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email avatar createdAt role accountType');

      return {
        totalUsers,
        activeUsers,
        inactiveUsers,
        bannedUsers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        usersByRole: roleStats,
        usersByAccountType: accountTypeStats,
        averageCoinsPerUser: Math.round(averageCoinsPerUser),
        totalCoinsInSystem,
        mostActiveUsers,
        recentRegistrations
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy danh sách người dùng với bộ lọc nâng cao cho admin
   * @param {Object} options - Các tùy chọn lọc
   * @returns {Object} Danh sách người dùng và thông tin phân trang
   */
  async getAllUsersAdmin(options = {}) {
    try {
      const {
        search = '',
        role,
        status,
        accountType,
        emailVerified,
        page = 1,
        limit = 100,
        sort = 'createdAt',
        order = 'desc',
        registrationDateFrom,
        registrationDateTo,
        lastActiveDateFrom,
        lastActiveDateTo,
        coinMin,
        coinMax
      } = options;

      const query = {};

      // Bộ lọc cơ bản
      if (role && role !== 'all') query.role = role;
      if (status && status !== 'all') query.status = status;
      if (accountType && accountType !== 'all') query.accountType = accountType;
      if (emailVerified !== undefined) query.email_verified = emailVerified;

      // Tìm kiếm
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } }
        ];
      }

      // Bộ lọc ngày đăng ký
      if (registrationDateFrom || registrationDateTo) {
        query.createdAt = {};
        if (registrationDateFrom) query.createdAt.$gte = new Date(registrationDateFrom);
        if (registrationDateTo) query.createdAt.$lte = new Date(registrationDateTo);
      }

      // Bộ lọc ngày hoạt động cuối
      if (lastActiveDateFrom || lastActiveDateTo) {
        query.last_active = {};
        if (lastActiveDateFrom) query.last_active.$gte = new Date(lastActiveDateFrom);
        if (lastActiveDateTo) query.last_active.$lte = new Date(lastActiveDateTo);
      }

      // Bộ lọc coin
      if (coinMin !== undefined || coinMax !== undefined) {
        query.coin = {};
        if (coinMin !== undefined) query.coin.$gte = coinMin;
        if (coinMax !== undefined) query.coin.$lte = coinMax;
      }

      // Sắp xếp
      const sortOrder = order === 'desc' ? -1 : 1;
      const sortObj = { [sort]: sortOrder };

      // Chuyển đổi page và limit thành số
      const numPage = parseInt(page);
      const numLimit = parseInt(limit);

      // Lấy danh sách người dùng
      const users = await User.find(query)
        .sort(sortObj)
        .skip((numPage - 1) * numLimit)
        .limit(numLimit)
        .select('-password -remember_token'); // Loại bỏ các trường nhạy cảm

      // Đếm tổng số
      const total = await User.countDocuments(query);

      return {
        users,
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
   * Cập nhật trạng thái người dùng
   * @param {string} id - ID người dùng
   * @param {string} status - Trạng thái mới
   * @returns {Object} Người dùng đã cập nhật
   */
  async updateUserStatus(id, status) {
    try {
      const user = await User.findByIdAndUpdate(
        id,
        { status, updatedAt: new Date() },
        { new: true }
      ).select('-password -remember_token');

      if (!user) {
        throw new Error('Không tìm thấy người dùng');
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật vai trò người dùng
   * @param {string} id - ID người dùng
   * @param {string} role - Vai trò mới
   * @returns {Object} Người dùng đã cập nhật
   */
  async updateUserRole(id, role) {
    try {
      const user = await User.findByIdAndUpdate(
        id,
        { role, updatedAt: new Date() },
        { new: true }
      ).select('-password -remember_token');

      if (!user) {
        throw new Error('Không tìm thấy người dùng');
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Thực hiện thao tác hàng loạt trên người dùng
   * @param {Array} userIds - Danh sách ID người dùng
   * @param {string} operation - Thao tác cần thực hiện
   * @param {Object} data - Dữ liệu bổ sung
   * @returns {Object} Kết quả thao tác
   */
  async bulkUserOperations(userIds, operation, data = {}) {
    try {
      let result = { success: 0, failed: 0, errors: [] };

      switch (operation) {
        case 'delete':
          const deleteResult = await User.deleteMany({ _id: { $in: userIds } });
          result.success = deleteResult.deletedCount;
          break;

        case 'ban':
          const banResult = await User.updateMany(
            { _id: { $in: userIds } },
            { status: 'banned', updatedAt: new Date() }
          );
          result.success = banResult.modifiedCount;
          break;

        case 'unban':
        case 'activate':
          const activateResult = await User.updateMany(
            { _id: { $in: userIds } },
            { status: 'active', updatedAt: new Date() }
          );
          result.success = activateResult.modifiedCount;
          break;

        case 'deactivate':
          const deactivateResult = await User.updateMany(
            { _id: { $in: userIds } },
            { status: 'inactive', updatedAt: new Date() }
          );
          result.success = deactivateResult.modifiedCount;
          break;

        case 'changeRole':
          if (!data.role) {
            throw new Error('Vai trò không được cung cấp');
          }
          const roleResult = await User.updateMany(
            { _id: { $in: userIds } },
            { role: data.role, updatedAt: new Date() }
          );
          result.success = roleResult.modifiedCount;
          break;

        case 'verifyEmail':
          const verifyResult = await User.updateMany(
            { _id: { $in: userIds } },
            { email_verified: true, email_verified_at: new Date(), updatedAt: new Date() }
          );
          result.success = verifyResult.modifiedCount;
          break;

        default:
          throw new Error('Thao tác không hợp lệ');
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thống kê đăng ký theo ngày (daily)
   * @param {number} days - Số ngày gần đây
   * @param {string} timezone - Múi giờ
   * @returns {Array} Thống kê đăng ký theo ngày
   */
  async getRegistrationStatsDaily(days = 30, timezone = 'Asia/Ho_Chi_Minh') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $addFields: {
            localDate: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: timezone
              }
            }
          }
        },
        {
          $group: {
            _id: "$localDate",
            count: { $sum: 1 },
            users: { $push: { id: "$_id", name: "$name", email: "$email" } }
          }
        },
        {
          $sort: { _id: 1 }
        },
        {
          $project: {
            date: "$_id",
            count: 1,
            users: 1,
            _id: 0
          }
        }
      ];

      const result = await User.aggregate(pipeline);

      // Fill missing dates with 0 count
      const filledResult = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const existingData = result.find(item => item.date === dateStr);

        filledResult.push({
          date: dateStr,
          count: existingData ? existingData.count : 0,
          users: existingData ? existingData.users : []
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return filledResult;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thống kê đăng ký theo tháng (monthly)
   * @param {number} months - Số tháng gần đây
   * @param {string} timezone - Múi giờ
   * @returns {Array} Thống kê đăng ký theo tháng
   */
  async getRegistrationStatsMonthly(months = 12, timezone = 'Asia/Ho_Chi_Minh') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      startDate.setDate(1); // Start from first day of month

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $addFields: {
            localDate: {
              $dateToString: {
                format: "%Y-%m",
                date: "$createdAt",
                timezone: timezone
              }
            }
          }
        },
        {
          $group: {
            _id: "$localDate",
            count: { $sum: 1 },
            users: { $push: { id: "$_id", name: "$name", email: "$email" } }
          }
        },
        {
          $sort: { _id: 1 }
        },
        {
          $project: {
            month: "$_id",
            count: 1,
            users: 1,
            _id: 0
          }
        }
      ];

      const result = await User.aggregate(pipeline);

      // Fill missing months with 0 count
      const filledResult = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const existingData = result.find(item => item.month === monthStr);

        filledResult.push({
          month: monthStr,
          count: existingData ? existingData.count : 0,
          users: existingData ? existingData.users : []
        });

        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      return filledResult;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thống kê đăng ký theo năm (yearly)
   * @param {number} years - Số năm gần đây
   * @param {string} timezone - Múi giờ
   * @returns {Array} Thống kê đăng ký theo năm
   */
  async getRegistrationStatsYearly(years = 5, timezone = 'Asia/Ho_Chi_Minh') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - years);
      startDate.setMonth(0, 1); // Start from January 1st

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $addFields: {
            localYear: {
              $dateToString: {
                format: "%Y",
                date: "$createdAt",
                timezone: timezone
              }
            }
          }
        },
        {
          $group: {
            _id: "$localYear",
            count: { $sum: 1 },
            users: { $push: { id: "$_id", name: "$name", email: "$email" } }
          }
        },
        {
          $sort: { _id: 1 }
        },
        {
          $project: {
            year: "$_id",
            count: 1,
            users: 1,
            _id: 0
          }
        }
      ];

      const result = await User.aggregate(pipeline);

      // Fill missing years with 0 count
      const filledResult = [];
      const currentYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();

      for (let year = currentYear; year <= endYear; year++) {
        const existingData = result.find(item => parseInt(item.year) === year);

        filledResult.push({
          year: year.toString(),
          count: existingData ? existingData.count : 0,
          users: existingData ? existingData.users : []
        });
      }

      return filledResult;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thống kê đăng ký theo khoảng thời gian tùy chỉnh
   * @param {Date} startDate - Ngày bắt đầu
   * @param {Date} endDate - Ngày kết thúc
   * @param {string} period - Chu kỳ (daily, monthly, yearly)
   * @param {string} timezone - Múi giờ
   * @returns {Array} Thống kê đăng ký
   */
  async getRegistrationStatsCustomRange(startDate, endDate, period = 'daily', timezone = 'Asia/Ho_Chi_Minh') {
    try {
      let format, groupBy;

      switch (period) {
        case 'daily':
          format = "%Y-%m-%d";
          groupBy = "date";
          break;
        case 'monthly':
          format = "%Y-%m";
          groupBy = "month";
          break;
        case 'yearly':
          format = "%Y";
          groupBy = "year";
          break;
        default:
          throw new Error('Invalid period');
      }

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $addFields: {
            localDate: {
              $dateToString: {
                format: format,
                date: "$createdAt",
                timezone: timezone
              }
            }
          }
        },
        {
          $group: {
            _id: "$localDate",
            count: { $sum: 1 },
            users: { $push: { id: "$_id", name: "$name", email: "$email" } }
          }
        },
        {
          $sort: { _id: 1 }
        },
        {
          $project: {
            [groupBy]: "$_id",
            count: 1,
            users: 1,
            _id: 0
          }
        }
      ];

      return await User.aggregate(pipeline);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy tổng quan thống kê đăng ký
   * @param {string} timezone - Múi giờ
   * @returns {Object} Tổng quan thống kê
   */
  async getRegistrationOverview(timezone = 'Asia/Ho_Chi_Minh') {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const thisYear = new Date(today.getFullYear(), 0, 1);

      const [
        totalUsers,
        todayUsers,
        yesterdayUsers,
        weekUsers,
        monthUsers,
        yearUsers
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: today } }),
        User.countDocuments({ createdAt: { $gte: yesterday, $lt: today } }),
        User.countDocuments({ createdAt: { $gte: thisWeek } }),
        User.countDocuments({ createdAt: { $gte: thisMonth } }),
        User.countDocuments({ createdAt: { $gte: thisYear } })
      ]);

      // Calculate growth rates
      const todayGrowth = yesterdayUsers > 0 ? ((todayUsers - yesterdayUsers) / yesterdayUsers * 100) : 0;

      return {
        total: totalUsers,
        today: todayUsers,
        yesterday: yesterdayUsers,
        thisWeek: weekUsers,
        thisMonth: monthUsers,
        thisYear: yearUsers,
        growth: {
          daily: Math.round(todayGrowth * 100) / 100
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thống kê đăng ký theo loại tài khoản
   * @param {string} period - Chu kỳ
   * @param {number} periods - Số chu kỳ
   * @param {string} timezone - Múi giờ
   * @returns {Array} Thống kê theo loại tài khoản
   */
  async getRegistrationStatsByAccountType(period = 'monthly', periods = 12, timezone = 'Asia/Ho_Chi_Minh') {
    try {
      const endDate = new Date();
      const startDate = new Date();

      if (period === 'monthly') {
        startDate.setMonth(startDate.getMonth() - periods);
      } else if (period === 'daily') {
        startDate.setDate(startDate.getDate() - periods);
      }

      const format = period === 'monthly' ? "%Y-%m" : "%Y-%m-%d";

      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $addFields: {
            localDate: {
              $dateToString: {
                format: format,
                date: "$createdAt",
                timezone: timezone
              }
            }
          }
        },
        {
          $group: {
            _id: {
              date: "$localDate",
              accountType: "$accountType"
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: "$_id.date",
            data: {
              $push: {
                accountType: "$_id.accountType",
                count: "$count"
              }
            },
            total: { $sum: "$count" }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ];

      return await User.aggregate(pipeline);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thống kê tăng trưởng
   * @param {string} period - Chu kỳ
   * @param {number} periods - Số chu kỳ
   * @param {string} timezone - Múi giờ
   * @returns {Array} Thống kê tăng trưởng
   */
  async getRegistrationGrowthRate(period = 'monthly', periods = 12, timezone = 'Asia/Ho_Chi_Minh') {
    try {
      let stats;

      if (period === 'monthly') {
        stats = await this.getRegistrationStatsMonthly(periods, timezone);
      } else if (period === 'daily') {
        stats = await this.getRegistrationStatsDaily(periods, timezone);
      } else {
        stats = await this.getRegistrationStatsYearly(periods, timezone);
      }

      // Calculate growth rate for each period
      const growthStats = stats.map((current, index) => {
        const previous = index > 0 ? stats[index - 1] : null;
        let growthRate = 0;

        if (previous && previous.count > 0) {
          growthRate = ((current.count - previous.count) / previous.count) * 100;
        }

        return {
          ...current,
          growthRate: Math.round(growthRate * 100) / 100,
          previousCount: previous ? previous.count : 0
        };
      });

      return growthStats;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new UserService();