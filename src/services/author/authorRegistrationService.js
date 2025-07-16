const mongoose = require('mongoose');
const User = require('../../models/user');
const Author = require('../../models/author');
const Transaction = require('../../models/transaction');
const authorEligibilityService = require('./authorEligibilityService');
const authorService = require('./authorService');

/**
 * Service xử lý đăng ký tác giả
 */
class AuthorRegistrationService {
  /**
   * Đăng ký user thành tác giả
   * @param {string} userId - ID của user
   * @param {Object} options - Tùy chọn đăng ký
   * @param {string} options.authorName - Tên tác giả (tùy chọn)
   * @returns {Object} Kết quả đăng ký
   */
  async registerAsAuthor(userId, options = {}) {
    // Note: Using individual operations instead of transactions for standalone MongoDB
    try {

      // Kiểm tra điều kiện đăng ký
      const eligibilityResult = await authorEligibilityService.checkEligibility(userId);
      
      if (!eligibilityResult.eligible) {
        throw new Error(`Không đủ điều kiện đăng ký: ${eligibilityResult.reason || 'Chưa đáp ứng yêu cầu'}`);
      }

      // Lấy thông tin user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Không tìm thấy user');
      }

      // Kiểm tra lại số xu hiện tại
      const registrationFee = 5000;
      const currentCoins = user.coin || user.coins || 0;
      if (currentCoins < registrationFee) {
        throw new Error(`Không đủ xu. Cần ${registrationFee} xu, hiện có ${currentCoins} xu`);
      }

      // Tạo author record
      const authorName = options.authorName || user.name;

      // Kiểm tra tên tác giả có bị trùng không
      const existingAuthor = await Author.findOne({
        name: { $regex: new RegExp(`^${authorName}$`, 'i') } // Case-insensitive check
      });

      if (existingAuthor) {
        throw new Error(`Tên tác giả "${authorName}" đã được sử dụng. Vui lòng chọn tên khác.`);
      }

      const authorData = {
        name: authorName,
        authorType: 'system',
        userId: userId,
        status: true,
        approvalStatus: 'pending' // New authors start in pending status
      };

      // Thực hiện các thao tác theo thứ tự an toàn
      // 1. Tạo author record
      const author = new Author(authorData);
      await author.save();

      // 2. Trừ xu từ tài khoản user (KHÔNG cập nhật role - chờ admin duyệt)
      const newCoinBalance = currentCoins - registrationFee;
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          coin: newCoinBalance // Chỉ trừ xu, role vẫn giữ nguyên cho đến khi được duyệt
        },
        { new: true }
      );

      if (!updatedUser) {
        // Nếu cập nhật user thất bại, xóa author record đã tạo
        await Author.findByIdAndDelete(author._id);
        throw new Error('Không thể cập nhật thông tin user');
      }

      // Tạo transaction record
      const transactionId = `AUTHOR_REG_${Date.now()}_${userId}`;
      const transaction = new Transaction({
        user_id: userId,
        transaction_id: transactionId,
        description: `Đăng ký trở thành tác giả - Phí đăng ký`,
        coin_change: -registrationFee,
        type: 'purchase',
        direction: 'out',
        balance_after: newCoinBalance,
        status: 'completed',
        reference_type: 'other',
        reference_id: author._id,
        metadata: {
          authorId: author._id,
          authorName: authorName,
          registrationFee: registrationFee
        }
      });

      // 3. Lưu transaction record
      await transaction.save();

      return {
        success: true,
        message: 'Đăng ký tác giả thành công. Đơn đăng ký của bạn đang chờ phê duyệt.',
        data: {
          author: {
            id: author._id,
            name: author.name,
            slug: author.slug,
            authorType: author.authorType,
            approvalStatus: author.approvalStatus || 'pending',
            approvalDate: author.approvalDate,
            rejectionReason: author.rejectionReason,
            userId: author.userId,
            createdAt: author.createdAt
          },
          user: {
            id: user._id,
            name: user.name,
            role: user.role, // Giữ nguyên role hiện tại
            coins: newCoinBalance
          },
          transaction: {
            id: transaction._id,
            transactionId: transaction.transaction_id,
            amount: registrationFee,
            balanceAfter: newCoinBalance
          }
        }
      };

    } catch (error) {
      // Log error for debugging
      console.error('Error in registerAsAuthor:', error);
      throw error;
    }
  }

  /**
   * Lấy thông tin đăng ký tác giả của user
   * @param {string} userId - ID của user
   * @returns {Object} Thông tin đăng ký
   */
  async getRegistrationInfo(userId) {
    try {
      // Kiểm tra xem user đã là author chưa
      const author = await Author.findByUserId(userId);
      
      if (author) {
        return {
          isAuthor: true,
          author: {
            id: author._id,
            name: author.name,
            slug: author.slug,
            authorType: author.authorType,
            createdAt: author.createdAt,
            approvalStatus: author.approvalStatus || 'approved', // Default to approved for old records
            approvalDate: author.approvalDate,
            rejectionReason: author.rejectionReason,
            reviewedBy: author.reviewedBy
          },
          registrationDate: author.createdAt
        };
      }

      // Nếu chưa là author, kiểm tra điều kiện
      const eligibilityResult = await authorEligibilityService.checkEligibility(userId);
      
      return {
        isAuthor: false,
        eligibility: eligibilityResult,
        registrationFee: 5000
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy lịch sử đăng ký tác giả (Admin only)
   * @param {Object} options - Tùy chọn lọc
   * @returns {Object} Danh sách lịch sử đăng ký
   */
  async getRegistrationHistory(options = {}) {
    try {
      const { page = 1, limit = 20, startDate, endDate } = options;
      
      // Tạo query filter
      const filter = { authorType: 'system' };
      
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // Lấy danh sách authors với thông tin user
      const authors = await Author.find(filter)
        .populate('userId', 'name email coins role createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Author.countDocuments(filter);

      // Lấy thông tin transaction cho mỗi author
      const authorsWithTransactions = await Promise.all(
        authors.map(async (author) => {
          const transaction = await Transaction.findOne({
            user_id: author.userId,
            reference_id: author._id,
            type: 'purchase',
            description: { $regex: 'Đăng ký trở thành tác giả' }
          });

          return {
            author: {
              id: author._id,
              name: author.name,
              slug: author.slug,
              createdAt: author.createdAt
            },
            user: author.userId ? {
              id: author.userId._id,
              name: author.userId.name,
              email: author.userId.email,
              role: author.userId.role
            } : null,
            transaction: transaction ? {
              id: transaction._id,
              transactionId: transaction.transaction_id,
              amount: Math.abs(transaction.coin_change),
              date: transaction.transaction_date
            } : null
          };
        })
      );

      return {
        success: true,
        data: authorsWithTransactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Thống kê đăng ký tác giả
   * @returns {Object} Thống kê
   */
  async getRegistrationStats() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [
        totalSystemAuthors,
        monthlyRegistrations,
        yearlyRegistrations,
        totalRevenue
      ] = await Promise.all([
        Author.countDocuments({ authorType: 'system' }),
        Author.countDocuments({ 
          authorType: 'system',
          createdAt: { $gte: startOfMonth }
        }),
        Author.countDocuments({ 
          authorType: 'system',
          createdAt: { $gte: startOfYear }
        }),
        Transaction.aggregate([
          {
            $match: {
              type: 'purchase',
              description: { $regex: 'Đăng ký trở thành tác giả' },
              status: 'completed'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $abs: '$coin_change' } }
            }
          }
        ])
      ]);

      return {
        totalSystemAuthors,
        monthlyRegistrations,
        yearlyRegistrations,
        totalRevenue: totalRevenue[0]?.total || 0,
        averageRevenuePerAuthor: totalSystemAuthors > 0 ? 
          Math.round((totalRevenue[0]?.total || 0) / totalSystemAuthors) : 0
      };

    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthorRegistrationService();
