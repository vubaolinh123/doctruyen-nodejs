const User = require('../../models/user');
const Transaction = require('../../models/transaction');
const coinRepair = require('../../utils/coinRepair');

class CoinService {
  /**
   * Lấy thống kê xu
   * @param {string} timeRange - Khoảng thời gian ('day', 'week', 'month', 'year')
   */
  async getStats(timeRange = 'month') {
    return Transaction.getCoinStats(timeRange);
  }

  /**
   * Lấy dữ liệu biểu đồ xu
   * @param {string} timeRange - Khoảng thời gian ('day', 'week', 'month', 'year') 
   */
  async getChartData(timeRange = 'month') {
    return Transaction.getChartData(timeRange);
  }

  /**
   * Quản lý xu của người dùng
   * @param {string} userId - ID người dùng
   * @param {string} action - Hành động ('give', 'take', 'edit')
   * @param {number} amount - Số lượng xu
   * @param {string} note - Ghi chú
   * @param {Object} adminInfo - Thông tin admin
   */
  async manageCoins(userId, action, amount, note, adminInfo) {
    // Tìm người dùng
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    let result;
    const numAmount = Number(amount);

    switch (action) {
      case 'give':
        result = await user.addCoins(numAmount, {
          description: note || 'Thêm xu bởi admin',
          type: 'admin',
          metadata: adminInfo
        });
        break;

      case 'take':
        if (user.coin < numAmount) {
          throw new Error('Số xu không đủ để trừ');
        }

        result = await user.subtractCoins(numAmount, {
          description: note || 'Trừ xu bởi admin',
          type: 'admin',
          metadata: adminInfo
        });
        break;

      case 'edit':
        result = await user.updateCoins(numAmount, {
          description: note || 'Cập nhật xu bởi admin',
          type: 'admin',
          metadata: adminInfo
        });
        break;

      default:
        throw new Error('Invalid action');
    }

    return {
      newBalance: result,
      action,
      amount: numAmount
    };
  }

  /**
   * Lấy lịch sử giao dịch xu của người dùng
   * @param {Object} options - Các tùy chọn truy vấn
   */
  async getTransactions(options) {
    const {
      userId,
      page = 1,
      limit = 10,
      type,
      direction,
      status,
      agent,
      startDate,
      endDate,
      search
    } = options;

    if (!userId) {
      throw new Error('User ID is required');
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Xây dựng query
    const query = { user_id: userId };

    // Thêm điều kiện lọc theo loại giao dịch
    if (type && type !== 'all') {
      query.type = type;
    }

    // Thêm điều kiện lọc theo hướng giao dịch (in/out)
    if (direction && direction !== 'all') {
      query.direction = direction;
    }

    // Thêm điều kiện lọc theo trạng thái
    if (status && status !== 'all') {
      query.status = status;
    }

    // Thêm điều kiện lọc theo agent
    if (agent && agent !== 'all') {
      query.agent = agent;
    }

    // Thêm điều kiện lọc theo thời gian
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Thêm 1 ngày để bao gồm cả ngày kết thúc
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        query.createdAt.$lt = endDateObj;
      }
    }

    // Thêm điều kiện tìm kiếm
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { ref_code: { $regex: search, $options: 'i' } }
      ];
    }

    // Thực hiện truy vấn
    const [transactions, totalCount] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .populate('user_id', 'name email'),

      Transaction.countDocuments(query)
    ]);

    return {
      transactions,
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(totalCount / limitNumber)
      }
    };
  }

  /**
   * Sửa chữa số dư xu của người dùng
   * @param {string} adminId - ID của admin thực hiện sửa chữa
   */
  async repairCoins(adminId) {
    return coinRepair.repairAllUserCoins(adminId);
  }
}

module.exports = new CoinService(); 