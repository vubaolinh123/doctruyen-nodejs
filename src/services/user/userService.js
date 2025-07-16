const mongoose = require('mongoose');
const User = require('../../models/user');
const Transaction = require('../../models/transaction');
const StoriesReading = require('../../models/storiesReading');
const Comment = require('../../models/comment');
const UserRating = require('../../models/userRating');

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
      const user = await User.findById(id);
      if (!user) {
        throw new Error('Không tìm thấy người dùng');
      }

      // Handle avatar data conversion - same logic as authService.updateUserProfile
      if (updateData.avatar !== undefined) {
        if (typeof updateData.avatar === 'string' && updateData.avatar.startsWith('{')) {
          try {
            // Parse JSON string to object for new schema
            const avatarData = JSON.parse(updateData.avatar);
            user.avatar = {
              primaryUrl: avatarData.primaryUrl || avatarData.avatarUrl || '',
              variants: avatarData.variants || avatarData.sizes || [],
              googleDriveId: avatarData.googleDriveId || '',
              lastUpdated: new Date(),
              metadata: {
                originalFilename: avatarData.metadata?.originalFilename || '',
                processedVariants: avatarData.metadata?.processedVariants || 0,
                uploadedFiles: avatarData.metadata?.uploadedFiles || 0,
                fileSize: avatarData.metadata?.fileSize || '',
                mimeType: avatarData.metadata?.mimeType || '',
                dimensions: avatarData.metadata?.dimensions || { width: 0, height: 0 }
              }
            };
          } catch (e) {
            // If parsing fails, treat as simple URL
            user.avatar = {
              primaryUrl: updateData.avatar,
              variants: [],
              googleDriveId: '',
              lastUpdated: new Date(),
              metadata: {
                originalFilename: '',
                processedVariants: 0,
                uploadedFiles: 0,
                fileSize: '',
                mimeType: '',
                dimensions: { width: 0, height: 0 }
              }
            };
          }
        } else if (typeof updateData.avatar === 'object') {
          // Already an object, store directly
          user.avatar = updateData.avatar;
        } else {
          // Simple string URL - convert to object schema
          user.avatar = {
            primaryUrl: updateData.avatar,
            variants: [],
            googleDriveId: '',
            lastUpdated: new Date(),
            metadata: {
              originalFilename: '',
              processedVariants: 0,
              uploadedFiles: 0,
              fileSize: '',
              mimeType: '',
              dimensions: { width: 0, height: 0 }
            }
          };
        }
        // Remove avatar from updateData to prevent overwriting
        delete updateData.avatar;
      }

      // Handle banner data conversion - same logic as authService.updateUserProfile
      if (updateData.banner !== undefined) {
        if (typeof updateData.banner === 'string' && updateData.banner.startsWith('{')) {
          try {
            // Parse JSON string to object for new schema
            const bannerData = JSON.parse(updateData.banner);
            user.banner = {
              primaryUrl: bannerData.primaryUrl || bannerData.bannerUrl || '',
              variants: bannerData.variants || bannerData.sizes || [],
              googleDriveId: bannerData.googleDriveId || '',
              lastUpdated: new Date(),
              position: bannerData.position || 0.5,
              containerHeight: bannerData.containerHeight || 450,
              metadata: {
                fileName: bannerData.metadata?.fileName || '',
                size: bannerData.metadata?.size || '',
                mimeType: bannerData.metadata?.mimeType || ''
              }
            };
          } catch (e) {
            // If parsing fails, treat as simple URL
            user.banner = {
              primaryUrl: updateData.banner,
              variants: [],
              googleDriveId: '',
              lastUpdated: new Date(),
              position: 0.5,
              containerHeight: 450,
              metadata: {
                fileName: '',
                size: '',
                mimeType: ''
              }
            };
          }
        } else if (typeof updateData.banner === 'object') {
          // Already an object, store directly
          user.banner = updateData.banner;
        } else {
          // Simple string URL - convert to object schema
          user.banner = {
            primaryUrl: updateData.banner,
            variants: [],
            googleDriveId: '',
            lastUpdated: new Date(),
            position: 0.5,
            containerHeight: 450,
            metadata: {
              fileName: '',
              size: '',
              mimeType: ''
            }
          };
        }
        // Remove banner from updateData to prevent overwriting
        delete updateData.banner;
      }

      // Handle social data properly
      if (updateData.bio !== undefined ||
          updateData.facebook !== undefined ||
          updateData.twitter !== undefined ||
          updateData.instagram !== undefined ||
          updateData.youtube !== undefined ||
          updateData.website !== undefined) {

        // Initialize social object if it doesn't exist
        if (!user.social) {
          user.social = {
            bio: '',
            facebook: '',
            twitter: '',
            instagram: '',
            youtube: '',
            website: ''
          };
        }

        // Update social fields
        if (updateData.bio !== undefined) user.social.bio = updateData.bio;
        if (updateData.facebook !== undefined) user.social.facebook = updateData.facebook;
        if (updateData.twitter !== undefined) user.social.twitter = updateData.twitter;
        if (updateData.instagram !== undefined) user.social.instagram = updateData.instagram;
        if (updateData.youtube !== undefined) user.social.youtube = updateData.youtube;
        if (updateData.website !== undefined) user.social.website = updateData.website;

        // Remove social fields from updateData to prevent overwriting
        delete updateData.bio;
        delete updateData.facebook;
        delete updateData.twitter;
        delete updateData.instagram;
        delete updateData.youtube;
        delete updateData.website;
      }

      // Handle birthday field with proper date conversion
      if (updateData.birthday !== undefined) {
        if (updateData.birthday === '' || updateData.birthday === null) {
          user.birthday = null;
        } else {
          // Ensure birthday is stored as a proper Date object
          try {
            const birthdayDate = new Date(updateData.birthday);
            if (!isNaN(birthdayDate.getTime())) {
              user.birthday = birthdayDate;
            } else {
              console.warn('[UserService] Invalid birthday format:', updateData.birthday);
            }
          } catch (error) {
            console.warn('[UserService] Error parsing birthday:', error);
          }
        }
        delete updateData.birthday;
      }

      // Apply remaining updates
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          user[key] = updateData[key];
        }
      });

      // Save the user with all updates
      const updatedUser = await user.save();
      return updatedUser;
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
    try {
      // Kiểm tra user tồn tại
      const user = await User.findById(id);
      if (!user) {
        throw new Error('Không tìm thấy người dùng');
      }

      console.log(`[UserService] Bắt đầu xóa user ${id} và tất cả dữ liệu liên quan`);

        // Helper function để import model an toàn
        const safeRequireModel = (modelPath) => {
          try {
            return require(modelPath);
          } catch (error) {
            console.log(`[UserService] Model ${modelPath} không tồn tại, bỏ qua`);
            return null;
          }
        };

        // Import các models cần thiết (chỉ những model thực sự tồn tại)
        const StoriesReading = safeRequireModel('../../models/storiesReading');
        const Comment = safeRequireModel('../../models/comment');
        const UserRating = safeRequireModel('../../models/userRating');
        const Attendance = safeRequireModel('../../models/attendance');
        const UserAttendanceReward = safeRequireModel('../../models/userAttendanceReward');
        const UserPermission = safeRequireModel('../../models/userPermission');
        const Transaction = safeRequireModel('../../models/transaction');
        const MissionProgress = safeRequireModel('../../models/missionProgress');
        const AchievementProgress = safeRequireModel('../../models/achievementProgress');
        const PurchasedStory = safeRequireModel('../../models/purchasedStory');
        const UserPurchases = safeRequireModel('../../models/userPurchases');
        const Notification = safeRequireModel('../../models/notification');
        const Author = safeRequireModel('../../models/author');
        const RefreshTokenModule = safeRequireModel('../../models/refreshToken');
        const RefreshToken = RefreshTokenModule ? RefreshTokenModule.RefreshToken : null;

        let totalDeleted = 0;

      // 1. Xóa reading history
      if (StoriesReading) {
        const readingResult = await StoriesReading.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${readingResult.deletedCount} reading history records`);
        totalDeleted += readingResult.deletedCount;
      }

      // 2. Xóa comments và cập nhật liked_by arrays
      if (Comment) {
        const commentResult = await Comment.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${commentResult.deletedCount} comments`);
        totalDeleted += commentResult.deletedCount;

        // Xóa user khỏi liked_by arrays trong comments khác
        const likedCommentsResult = await Comment.updateMany(
          { 'engagement.liked_by': id },
          { $pull: { 'engagement.liked_by': id } }
        );
        console.log(`[UserService] Đã xóa user khỏi ${likedCommentsResult.modifiedCount} liked comments`);
      }

      // 3. Xóa ratings
      if (UserRating) {
        const ratingResult = await UserRating.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${ratingResult.deletedCount} ratings`);
        totalDeleted += ratingResult.deletedCount;
      }

      // 4. Xóa attendance records
      if (Attendance) {
        const attendanceResult = await Attendance.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${attendanceResult.deletedCount} attendance records`);
        totalDeleted += attendanceResult.deletedCount;
      }

      // 5. Xóa attendance rewards
      if (UserAttendanceReward) {
        const attendanceRewardResult = await UserAttendanceReward.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${attendanceRewardResult.deletedCount} attendance rewards`);
        totalDeleted += attendanceRewardResult.deletedCount;
      }

      // 6. Xóa user permissions
      if (UserPermission) {
        const permissionResult = await UserPermission.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${permissionResult.deletedCount} user permissions`);
        totalDeleted += permissionResult.deletedCount;
      }

      // 7. Xóa transactions
      if (Transaction) {
        const transactionResult = await Transaction.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${transactionResult.deletedCount} transactions`);
        totalDeleted += transactionResult.deletedCount;
      }

      // 8. Xóa purchased stories
      if (PurchasedStory) {
        const purchasedResult = await PurchasedStory.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${purchasedResult.deletedCount} purchased stories`);
        totalDeleted += purchasedResult.deletedCount;
      }

      // 9. Xóa user purchases
      if (UserPurchases) {
        const userPurchasesResult = await UserPurchases.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${userPurchasesResult.deletedCount} user purchases`);
        totalDeleted += userPurchasesResult.deletedCount;
      }

      // 10. Xóa notifications
      if (Notification) {
        const notificationResult = await Notification.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${notificationResult.deletedCount} notifications`);
        totalDeleted += notificationResult.deletedCount;
      }

      // 11. Xóa mission progress
      if (MissionProgress) {
        const missionResult = await MissionProgress.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${missionResult.deletedCount} mission progress records`);
        totalDeleted += missionResult.deletedCount;
      }

      // 12. Xóa achievement progress
      if (AchievementProgress) {
        const achievementResult = await AchievementProgress.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${achievementResult.deletedCount} achievement progress records`);
        totalDeleted += achievementResult.deletedCount;
      }

      // 13. Xóa author records (nếu user là author)
      if (Author) {
        const authorResult = await Author.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${authorResult.deletedCount} author records`);
        totalDeleted += authorResult.deletedCount;
      }

      // 14. Xóa refresh tokens
      if (RefreshToken) {
        const refreshTokenResult = await RefreshToken.deleteMany({ user_id: id });
        console.log(`[UserService] Đã xóa ${refreshTokenResult.deletedCount} refresh tokens`);
        totalDeleted += refreshTokenResult.deletedCount;
      }



      // 15. Cuối cùng xóa user
      const deletedUser = await User.findByIdAndDelete(id);
      console.log(`[UserService] Đã xóa user ${id} thành công`);
      totalDeleted += 1; // User record itself

      // Tạo summary chi tiết
      const deletionSummary = {
        user: {
          id: deletedUser._id,
          name: deletedUser.name,
          email: deletedUser.email,
          role: deletedUser.role
        },
        totalRecordsDeleted: totalDeleted,
        success: true
      };

      // Log tổng kết chi tiết
      console.log(`[UserService] Hoàn thành xóa user ${id} và tất cả dữ liệu liên quan:
        - User: ${deletedUser.name} (${deletedUser.email})
        - Total Records Deleted: ${deletionSummary.totalRecordsDeleted}`);

      return deletionSummary;
    } catch (error) {
      console.error(`[UserService] Lỗi khi xóa user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Lấy thông tin preview về dữ liệu sẽ bị xóa khi xóa user
   * @param {string} id - ID người dùng
   * @returns {Object} Thông tin preview
   */
  async getUserDeletionPreview(id) {
    try {
      // Kiểm tra user tồn tại
      const user = await User.findById(id).select('_id name email role status');
      if (!user) {
        throw new Error('Không tìm thấy người dùng');
      }

      console.log(`[UserService] Getting deletion preview for user ${id}`);

      // Import các models và đếm records
      const counts = {};

      try {
        const Bookmark = require('../../models/bookmark');
        counts.bookmarks = await Bookmark.countDocuments({ user_id: id });
      } catch (err) {
        counts.bookmarks = 0;
      }

      try {
        const StoriesReading = require('../../models/storiesReading');
        counts.readingHistory = await StoriesReading.countDocuments({ user_id: id });
      } catch (err) {
        counts.readingHistory = 0;
      }

      try {
        const Comment = require('../../models/comment');
        counts.comments = await Comment.countDocuments({ user_id: id });
        counts.likedComments = await Comment.countDocuments({ 'engagement.liked_by': id });
      } catch (err) {
        counts.comments = 0;
        counts.likedComments = 0;
      }

      try {
        const UserRating = require('../../models/userRating');
        counts.ratings = await UserRating.countDocuments({ user_id: id });
      } catch (err) {
        counts.ratings = 0;
      }

      try {
        const Attendance = require('../../models/attendance');
        counts.attendance = await Attendance.countDocuments({ user_id: id });
      } catch (err) {
        counts.attendance = 0;
      }

      try {
        const UserAttendanceReward = require('../../models/userAttendanceReward');
        counts.attendanceRewards = await UserAttendanceReward.countDocuments({ user_id: id });
      } catch (err) {
        counts.attendanceRewards = 0;
      }

      try {
        const UserPermission = require('../../models/userPermission');
        counts.permissions = await UserPermission.countDocuments({ user_id: id });
      } catch (err) {
        counts.permissions = 0;
      }

      try {
        const Transaction = require('../../models/transaction');
        counts.transactions = await Transaction.countDocuments({ user_id: id });
      } catch (err) {
        counts.transactions = 0;
      }

      try {
        const PurchasedStory = require('../../models/purchasedStory');
        counts.purchasedStories = await PurchasedStory.countDocuments({ user_id: id });
      } catch (err) {
        counts.purchasedStories = 0;
      }

      try {
        const UserPurchases = require('../../models/userPurchases');
        counts.userPurchases = await UserPurchases.countDocuments({ user_id: id });
      } catch (err) {
        counts.userPurchases = 0;
      }

      try {
        const Notification = require('../../models/notification');
        counts.notifications = await Notification.countDocuments({ user_id: id });
      } catch (err) {
        counts.notifications = 0;
      }

      try {
        const MissionProgress = require('../../models/missionProgress');
        counts.missionProgress = await MissionProgress.countDocuments({ user_id: id });
      } catch (err) {
        counts.missionProgress = 0;
      }

      try {
        const AchievementProgress = require('../../models/achievementProgress');
        counts.achievementProgress = await AchievementProgress.countDocuments({ user_id: id });
      } catch (err) {
        counts.achievementProgress = 0;
      }

      try {
        const Author = require('../../models/author');
        counts.authorRecords = await Author.countDocuments({ userId: id });
      } catch (err) {
        counts.authorRecords = 0;
      }

      try {
        const RefreshToken = require('../../models/refreshToken');
        counts.refreshTokens = await RefreshToken.countDocuments({ user_id: id });
      } catch (err) {
        counts.refreshTokens = 0;
      }

      // Tính tổng số records sẽ bị xóa
      const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0) + 1; // +1 for user record

      const preview = {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        },
        dataToDelete: counts,
        totalRecordsToDelete: totalRecords,
        warning: totalRecords > 0 ?
          `Thao tác này sẽ xóa vĩnh viễn ${totalRecords} bản ghi dữ liệu và không thể hoàn tác.` :
          'Người dùng này không có dữ liệu liên quan để xóa.'
      };

      console.log(`[UserService] Deletion preview for user ${id}: ${totalRecords} total records`);
      return preview;
    } catch (error) {
      console.error(`[UserService] Error getting deletion preview for user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Xóa hàng loạt người dùng với cascade deletion
   * @param {Array} userIds - Danh sách ID người dùng
   * @returns {Object} Kết quả xóa chi tiết
   */
  async bulkDeleteUsers(userIds) {
    try {
      console.log(`[UserService] Starting bulk delete for ${userIds.length} users`);

      if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new Error('Danh sách ID người dùng không hợp lệ');
      }

      // Check which users exist
      const existingUsers = await User.find({ _id: { $in: userIds } }).select('_id name email role');
      const existingUserIds = existingUsers.map(user => user._id.toString());
      const notFoundIds = userIds.filter(id => !existingUserIds.includes(id.toString()));

      let result = {
        success: 0,
        failed: notFoundIds.length,
        total: userIds.length,
        errors: [],
        deletionSummaries: [],
        totalRecordsDeleted: 0
      };

      // Add not found errors
      notFoundIds.forEach(id => {
        result.errors.push(`Không tìm thấy người dùng với ID: ${id}`);
      });

      // Delete each user individually to ensure proper cascade deletion
      for (const user of existingUsers) {
        try {
          const deletionSummary = await this.deleteUser(user._id.toString());
          result.success++;
          result.deletionSummaries.push(deletionSummary);
          result.totalRecordsDeleted += deletionSummary.totalRecordsDeleted || 1;

          console.log(`[UserService] Successfully deleted user: ${user.name} (${user.email})`);
        } catch (error) {
          result.failed++;
          result.errors.push(`Lỗi khi xóa người dùng ${user.name} (${user.email}): ${error.message}`);
          console.error(`[UserService] Failed to delete user ${user._id}:`, error);
        }
      }

      console.log(`[UserService] Bulk delete completed: ${result.success} success, ${result.failed} failed, ${result.totalRecordsDeleted} total records deleted`);
      return result;
    } catch (error) {
      console.error(`[UserService] Bulk delete error:`, error);
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
   * Thực hiện thao tác hàng loạt trên người dùng với validation và error handling nâng cao
   * @param {Array} userIds - Danh sách ID người dùng
   * @param {string} operation - Thao tác cần thực hiện
   * @param {Object} data - Dữ liệu bổ sung
   * @returns {Object} Kết quả thao tác chi tiết
   */
  async bulkUserOperations(userIds, operation, data = {}) {
    try {
      console.log(`[UserService] Starting bulk operation: ${operation} for ${userIds.length} users`);

      // Validate input
      if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new Error('Danh sách ID người dùng không hợp lệ');
      }

      // Validate operation
      const validOperations = ['delete', 'activate', 'deactivate', 'ban', 'setUser', 'setAuthor', 'setAdmin'];
      if (!validOperations.includes(operation)) {
        throw new Error(`Thao tác không hợp lệ. Các thao tác được hỗ trợ: ${validOperations.join(', ')}`);
      }

      // Check if users exist
      const existingUsers = await User.find({ _id: { $in: userIds } }).select('_id name email role status');
      const existingUserIds = existingUsers.map(user => user._id.toString());
      const notFoundIds = userIds.filter(id => !existingUserIds.includes(id.toString()));

      let result = {
        success: 0,
        failed: notFoundIds.length,
        total: userIds.length,
        errors: [],
        details: {
          processed: [],
          notFound: notFoundIds,
          summary: {}
        }
      };

      // Add not found errors
      notFoundIds.forEach(id => {
        result.errors.push(`Không tìm thấy người dùng với ID: ${id}`);
      });

      if (existingUsers.length === 0) {
        return result;
      }

      // Process bulk operation
      switch (operation) {
        case 'delete':
          // Use the comprehensive delete method for each user
          for (const user of existingUsers) {
            try {
              await this.deleteUser(user._id.toString());
              result.success++;
              result.details.processed.push({
                id: user._id,
                name: user.name,
                email: user.email,
                status: 'deleted'
              });
            } catch (error) {
              result.failed++;
              result.errors.push(`Lỗi khi xóa người dùng ${user.name} (${user.email}): ${error.message}`);
            }
          }
          break;

        case 'activate':
          const activateResult = await User.updateMany(
            { _id: { $in: existingUserIds } },
            { status: 'active', updatedAt: new Date() }
          );
          result.success = activateResult.modifiedCount;
          result.details.summary = { operation: 'activate', modified: activateResult.modifiedCount };
          break;

        case 'deactivate':
          const deactivateResult = await User.updateMany(
            { _id: { $in: existingUserIds } },
            { status: 'inactive', updatedAt: new Date() }
          );
          result.success = deactivateResult.modifiedCount;
          result.details.summary = { operation: 'deactivate', modified: deactivateResult.modifiedCount };
          break;

        case 'ban':
          const banResult = await User.updateMany(
            { _id: { $in: existingUserIds } },
            { status: 'banned', updatedAt: new Date() }
          );
          result.success = banResult.modifiedCount;
          result.details.summary = { operation: 'ban', modified: banResult.modifiedCount };
          break;

        case 'setUser':
          const setUserResult = await User.updateMany(
            { _id: { $in: existingUserIds } },
            { role: 'user', updatedAt: new Date() }
          );
          result.success = setUserResult.modifiedCount;
          result.details.summary = { operation: 'setUser', modified: setUserResult.modifiedCount };
          break;

        case 'setAuthor':
          const setAuthorResult = await User.updateMany(
            { _id: { $in: existingUserIds } },
            { role: 'author', updatedAt: new Date() }
          );
          result.success = setAuthorResult.modifiedCount;
          result.details.summary = { operation: 'setAuthor', modified: setAuthorResult.modifiedCount };
          break;

        case 'setAdmin':
          const setAdminResult = await User.updateMany(
            { _id: { $in: existingUserIds } },
            { role: 'admin', updatedAt: new Date() }
          );
          result.success = setAdminResult.modifiedCount;
          result.details.summary = { operation: 'setAdmin', modified: setAdminResult.modifiedCount };
          break;
      }

      console.log(`[UserService] Bulk operation ${operation} completed: ${result.success} success, ${result.failed} failed`);
      return result;
    } catch (error) {
      console.error(`[UserService] Bulk operation error:`, error);
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

  /**
   * Lấy thống kê toàn diện của người dùng
   * Bao gồm: thể loại yêu thích, thành tích, và hoạt động theo thời gian
   * @param {string} userId - ID người dùng
   * @returns {Object} Thống kê toàn diện
   */
  async getUserComprehensiveStats(userId) {
    try {
      console.log(`[UserService] Getting comprehensive stats for user: ${userId}`);

      // Convert userId to ObjectId
      const userObjectId = new mongoose.Types.ObjectId(userId);

      // 1. Lấy thống kê thể loại yêu thích
      const favoriteGenresStats = await this.getFavoriteGenresStats(userObjectId);

      // 2. Lấy thống kê thành tích
      const achievementsStats = await this.getAchievementsStats(userObjectId);

      // 3. Lấy dữ liệu hoạt động theo thời gian
      const activityTimelineStats = await this.getActivityTimelineStats(userObjectId);

      console.log(`[UserService] ✅ Successfully retrieved comprehensive stats for user: ${userId}`);

      return {
        favoriteGenres: favoriteGenresStats,
        achievements: achievementsStats,
        activityTimeline: activityTimelineStats
      };
    } catch (error) {
      console.error(`[UserService] ❌ Error getting comprehensive stats for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Lấy thống kê thể loại yêu thích của người dùng
   * @param {ObjectId} userId - ID người dùng
   * @returns {Array} Danh sách thể loại yêu thích
   */
  async getFavoriteGenresStats(userId) {
    try {
      const pipeline = [
        // Match user's reading records
        { $match: { user_id: userId } },

        // Lookup story information with categories
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },

        // Unwind story array
        { $unwind: '$story' },

        // Lookup categories
        {
          $lookup: {
            from: 'categories',
            localField: 'story.categories',
            foreignField: '_id',
            as: 'categories'
          }
        },

        // Unwind categories to count each genre separately
        { $unwind: '$categories' },

        // Group by category to count occurrences
        {
          $group: {
            _id: '$categories._id',
            name: { $first: '$categories.name' },
            slug: { $first: '$categories.slug' },
            count: { $sum: 1 }
          }
        },

        // Sort by count descending
        { $sort: { count: -1 } },

        // Limit to top 5 genres
        { $limit: 5 }
      ];

      const genreStats = await StoriesReading.aggregate(pipeline);

      // Calculate total stories for percentage calculation
      const totalStories = await StoriesReading.countDocuments({ user_id: userId });

      // Format results with percentages
      const formattedStats = genreStats.map(genre => ({
        name: genre.name,
        slug: genre.slug,
        count: genre.count,
        percentage: totalStories > 0 ? Math.round((genre.count / totalStories) * 100) : 0
      }));

      console.log(`[UserService] Found ${formattedStats.length} favorite genres for user`);
      return formattedStats;
    } catch (error) {
      console.error('[UserService] Error getting favorite genres stats:', error);
      throw error;
    }
  }

  /**
   * Lấy thống kê thành tích của người dùng
   * @param {ObjectId} userId - ID người dùng
   * @returns {Object} Thống kê thành tích
   */
  async getAchievementsStats(userId) {
    try {
      // Get reading stats using existing method
      const readingStats = await StoriesReading.getUserReadingStats(userId);

      // Count comments by user
      const totalComments = await Comment.countDocuments({ user_id: userId });

      // Count ratings by user
      const totalRatings = await UserRating.countDocuments({ user_id: userId });

      const achievements = {
        totalStoriesRead: readingStats.total_stories || 0,
        totalChaptersRead: readingStats.total_chapters_read || 0,
        totalComments: totalComments || 0,
        totalRatings: totalRatings || 0,
        totalReadingTime: readingStats.total_reading_time || 0 // in seconds
      };

      console.log(`[UserService] Retrieved achievements stats:`, achievements);
      return achievements;
    } catch (error) {
      console.error('[UserService] Error getting achievements stats:', error);
      throw error;
    }
  }

  /**
   * Lấy dữ liệu hoạt động theo thời gian của người dùng
   * @param {ObjectId} userId - ID người dùng
   * @returns {Object} Dữ liệu hoạt động theo thời gian
   */
  async getActivityTimelineStats(userId) {
    try {
      const timezone = 'Asia/Ho_Chi_Minh';

      // Get daily activity for last 30 days
      const dailyActivity = await this.getDailyActivityStats(userId, 30, timezone);

      // Get monthly activity for last 12 months
      const monthlyActivity = await this.getMonthlyActivityStats(userId, 12, timezone);

      // Get yearly activity for last 3 years
      const yearlyActivity = await this.getYearlyActivityStats(userId, 3, timezone);

      const activityTimeline = {
        daily: dailyActivity,
        monthly: monthlyActivity,
        yearly: yearlyActivity
      };

      console.log(`[UserService] Retrieved activity timeline with ${dailyActivity.length} daily, ${monthlyActivity.length} monthly, ${yearlyActivity.length} yearly records`);
      return activityTimeline;
    } catch (error) {
      console.error('[UserService] Error getting activity timeline stats:', error);
      throw error;
    }
  }

  /**
   * Lấy thống kê hoạt động hàng ngày
   * @param {ObjectId} userId - ID người dùng
   * @param {number} days - Số ngày gần đây
   * @param {string} timezone - Múi giờ
   * @returns {Array} Thống kê hoạt động hàng ngày
   */
  async getDailyActivityStats(userId, days = 30, timezone = 'Asia/Ho_Chi_Minh') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const pipeline = [
        {
          $match: {
            user_id: userId,
            'reading_stats.last_read_at': {
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
                date: "$reading_stats.last_read_at",
                timezone: timezone
              }
            }
          }
        },
        {
          $group: {
            _id: "$localDate",
            chaptersRead: { $sum: "$reading_stats.completed_chapters" },
            readingTime: { $sum: "$reading_stats.total_reading_time" },
            storiesAccessed: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        },
        {
          $project: {
            date: "$_id",
            chaptersRead: 1,
            readingTime: 1,
            storiesAccessed: 1,
            _id: 0
          }
        }
      ];

      return await StoriesReading.aggregate(pipeline);
    } catch (error) {
      console.error('[UserService] Error getting daily activity stats:', error);
      throw error;
    }
  }

  /**
   * Lấy thống kê hoạt động hàng tháng
   * @param {ObjectId} userId - ID người dùng
   * @param {number} months - Số tháng gần đây
   * @param {string} timezone - Múi giờ
   * @returns {Array} Thống kê hoạt động hàng tháng
   */
  async getMonthlyActivityStats(userId, months = 12, timezone = 'Asia/Ho_Chi_Minh') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const pipeline = [
        {
          $match: {
            user_id: userId,
            'reading_stats.last_read_at': {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $addFields: {
            localMonth: {
              $dateToString: {
                format: "%Y-%m",
                date: "$reading_stats.last_read_at",
                timezone: timezone
              }
            }
          }
        },
        {
          $group: {
            _id: "$localMonth",
            chaptersRead: { $sum: "$reading_stats.completed_chapters" },
            readingTime: { $sum: "$reading_stats.total_reading_time" },
            storiesAccessed: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        },
        {
          $project: {
            month: "$_id",
            chaptersRead: 1,
            readingTime: 1,
            storiesAccessed: 1,
            _id: 0
          }
        }
      ];

      return await StoriesReading.aggregate(pipeline);
    } catch (error) {
      console.error('[UserService] Error getting monthly activity stats:', error);
      throw error;
    }
  }

  /**
   * Lấy thống kê hoạt động hàng năm
   * @param {ObjectId} userId - ID người dùng
   * @param {number} years - Số năm gần đây
   * @param {string} timezone - Múi giờ
   * @returns {Array} Thống kê hoạt động hàng năm
   */
  async getYearlyActivityStats(userId, years = 3, timezone = 'Asia/Ho_Chi_Minh') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - years);

      const pipeline = [
        {
          $match: {
            user_id: userId,
            'reading_stats.last_read_at': {
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
                date: "$reading_stats.last_read_at",
                timezone: timezone
              }
            }
          }
        },
        {
          $group: {
            _id: "$localYear",
            chaptersRead: { $sum: "$reading_stats.completed_chapters" },
            readingTime: { $sum: "$reading_stats.total_reading_time" },
            storiesAccessed: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        },
        {
          $project: {
            year: "$_id",
            chaptersRead: 1,
            readingTime: 1,
            storiesAccessed: 1,
            _id: 0
          }
        }
      ];

      return await StoriesReading.aggregate(pipeline);
    } catch (error) {
      console.error('[UserService] Error getting yearly activity stats:', error);
      throw error;
    }
  }
}

module.exports = new UserService();