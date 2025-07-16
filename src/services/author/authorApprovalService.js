const mongoose = require('mongoose');
const Author = require('../../models/author');
const User = require('../../models/user');
const Transaction = require('../../models/transaction');
const Notification = require('../../models/notification');

/**
 * Service xử lý phê duyệt tác giả
 */
class AuthorApprovalService {
  /**
   * Lấy danh sách tác giả đang chờ phê duyệt
   * @param {Object} options - Tùy chọn phân trang
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng kết quả mỗi trang
   * @returns {Object} Danh sách tác giả đang chờ phê duyệt
   */
  async getPendingAuthors(options = {}) {
    const page = parseInt(options.page) || 1;
    const limit = parseInt(options.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { 
      authorType: 'system',
      approvalStatus: 'pending'
    };

    const [authors, total] = await Promise.all([
      Author.find(query)
        .populate('userId', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Author.countDocuments(query)
    ]);

    return {
      success: true,
      message: 'Lấy danh sách tác giả đang chờ phê duyệt thành công',
      data: {
        authors,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
  }

  /**
   * Phê duyệt đơn đăng ký tác giả
   * @param {string} authorId - ID của tác giả
   * @param {string} adminId - ID của admin thực hiện phê duyệt
   * @returns {Object} Kết quả phê duyệt
   */
  async approveAuthor(authorId, adminId) {
    try {
      // Tìm author record
      const author = await Author.findById(authorId);
      if (!author) {
        throw new Error('Không tìm thấy tác giả');
      }

      // Kiểm tra trạng thái hiện tại
      if (author.approvalStatus !== 'pending') {
        throw new Error(`Không thể phê duyệt tác giả có trạng thái ${author.approvalStatus}`);
      }

      // Cập nhật trạng thái author
      author.approvalStatus = 'approved';
      author.approvalDate = new Date();
      author.reviewedBy = adminId;
      await author.save();

      // Cập nhật role của user thành 'author' khi được phê duyệt
      if (author.userId) {
        await User.findByIdAndUpdate(author.userId, {
          role: 'author'
        });
      }

      // Tạo thông báo cho user
      if (author.userId) {
        try {
          await Notification.create({
            recipient_id: author.userId,
            type: 'admin_message',
            message: 'Đơn đăng ký tác giả đã được phê duyệt',
            content: `Chúc mừng! Đơn đăng ký tác giả của bạn đã được phê duyệt. Bạn có thể bắt đầu đăng truyện ngay bây giờ.`,
            read: false,
            metadata: {
              authorId: author._id,
              action: 'author_approved'
            }
          });
        } catch (notificationError) {
          console.error('Error creating notification:', notificationError);
          // Continue without notification if it fails
        }
      }

      return {
        success: true,
        message: 'Phê duyệt tác giả thành công',
        data: { author }
      };
    } catch (error) {
      console.error('Error in approveAuthor:', error);
      throw error;
    }
  }

  /**
   * Từ chối đơn đăng ký tác giả
   * @param {string} authorId - ID của tác giả
   * @param {string} adminId - ID của admin thực hiện từ chối
   * @param {string} reason - Lý do từ chối
   * @returns {Object} Kết quả từ chối
   */
  async rejectAuthor(authorId, adminId, reason) {
    try {
      // Tìm author record
      const author = await Author.findById(authorId);
      if (!author) {
        throw new Error('Không tìm thấy tác giả');
      }

      // Kiểm tra trạng thái hiện tại
      if (author.approvalStatus !== 'pending') {
        throw new Error(`Không thể từ chối tác giả có trạng thái ${author.approvalStatus}`);
      }

      // Cập nhật trạng thái
      author.approvalStatus = 'rejected';
      author.approvalDate = new Date();
      author.rejectionReason = reason || 'Không đáp ứng yêu cầu';
      author.reviewedBy = adminId;
      await author.save();

      // Hoàn lại xu cho user khi từ chối và reset role về 'user'
      const registrationFee = 5000;
      if (author.userId) {
        const user = await User.findById(author.userId);
        if (user) {
          const newCoinBalance = (user.coin || 0) + registrationFee;
          await User.findByIdAndUpdate(author.userId, {
            coin: newCoinBalance,
            role: 'user' // Reset role về user khi bị từ chối
          });

          // Tạo transaction record cho việc hoàn xu
          const transactionId = `AUTHOR_REJECT_REFUND_${Date.now()}_${author.userId}`;
          await Transaction.create({
            user_id: author.userId,
            transaction_id: transactionId,
            description: `Hoàn xu do đơn đăng ký tác giả bị từ chối - Lý do: ${reason || 'Không đáp ứng yêu cầu'}`,
            coin_change: registrationFee,
            type: 'refund',
            direction: 'in',
            balance_after: newCoinBalance,
            status: 'completed',
            reference_type: 'author_rejection',
            reference_id: author._id,
            metadata: {
              authorId: author._id,
              rejectionReason: reason,
              refundAmount: registrationFee
            }
          });
        }
      }

      // Tạo thông báo cho user
      if (author.userId) {
        try {
          await Notification.create({
            recipient_id: author.userId,
            type: 'admin_message',
            message: 'Đơn đăng ký tác giả đã bị từ chối',
            content: `Đơn đăng ký tác giả của bạn đã bị từ chối. Lý do: ${reason || 'Không đáp ứng yêu cầu'}`,
            read: false,
            metadata: {
              authorId: author._id,
              action: 'author_rejected',
              reason: reason
            }
          });
        } catch (notificationError) {
          console.error('Error creating notification:', notificationError);
          // Continue without notification if it fails
        }
      }

      return {
        success: true,
        message: 'Từ chối tác giả thành công',
        data: { author }
      };
    } catch (error) {
      console.error('Error in rejectAuthor:', error);
      throw error;
    }
  }

  /**
   * Xóa author record bị từ chối để cho phép đăng ký lại
   * @param {string} authorId - ID của author
   * @param {string} userId - ID của user yêu cầu xóa
   * @returns {Object} Kết quả xóa
   */
  async deleteRejectedAuthor(authorId, userId) {
    try {
      console.log('[AuthorApprovalService] deleteRejectedAuthor called with:', { authorId, userId });

      // Tìm author record
      const author = await Author.findById(authorId);
      console.log('[AuthorApprovalService] Found author:', author);

      if (!author) {
        console.log('[AuthorApprovalService] Author not found with ID:', authorId);
        throw new Error('Không tìm thấy tác giả');
      }

      // Kiểm tra quyền sở hữu
      if (author.userId.toString() !== userId) {
        throw new Error('Bạn không có quyền xóa author này');
      }

      // Kiểm tra trạng thái - chỉ cho phép xóa rejected authors
      if (author.approvalStatus !== 'rejected') {
        throw new Error('Chỉ có thể xóa author có trạng thái rejected');
      }

      // Xóa author record
      await Author.findByIdAndDelete(authorId);

      return {
        success: true,
        message: 'Đã xóa author bị từ chối thành công. Bạn có thể đăng ký lại.',
        data: { authorId }
      };
    } catch (error) {
      console.error('Error in deleteRejectedAuthor:', error);
      throw error;
    }
  }
}

module.exports = new AuthorApprovalService();
