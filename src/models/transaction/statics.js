const mongoose = require('mongoose');

/**
 * Định nghĩa các static methods cho Transaction model
 * @param {Object} schema - Schema của Transaction
 */
module.exports = function(schema) {
  /**
   * Lấy thống kê xu
   * @param {string} timeRange - Khoảng thời gian ('day', 'week', 'month', 'year')
   * @returns {Object} - Thống kê xu
   */
  schema.statics.getCoinStats = async function(timeRange = 'month') {
    // Xác định khoảng thời gian
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
    }

    // Thực hiện truy vấn thống kê
    const stats = await this.aggregate([
      {
        $match: {
          transaction_date: { $gte: startDate, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalCoinsIn: { $sum: { $cond: [{ $gt: ['$coin_change', 0] }, '$coin_change', 0] } },
          totalCoinsOut: { $sum: { $cond: [{ $lt: ['$coin_change', 0] }, { $abs: '$coin_change' }, 0] } },
          uniqueUsers: { $addToSet: '$user_id' }
        }
      },
      {
        $project: {
          _id: 0,
          totalTransactions: 1,
          totalCoinsIn: 1,
          totalCoinsOut: 1,
          netChange: { $subtract: ['$totalCoinsIn', '$totalCoinsOut'] },
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      }
    ]);

    // Thống kê theo loại giao dịch
    const typeStats = await this.aggregate([
      {
        $match: {
          transaction_date: { $gte: startDate, $lte: now }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalCoins: { $sum: '$coin_change' }
        }
      }
    ]);

    // Định dạng kết quả
    return {
      summary: stats.length > 0 ? stats[0] : {
        totalTransactions: 0,
        totalCoinsIn: 0,
        totalCoinsOut: 0,
        netChange: 0,
        uniqueUsers: 0
      },
      byType: typeStats.reduce((acc, item) => {
        acc[item._id] = {
          count: item.count,
          totalCoins: item.totalCoins
        };
        return acc;
      }, {}),
      timeRange
    };
  };

  /**
   * Lấy dữ liệu biểu đồ xu
   * @param {string} timeRange - Khoảng thời gian ('day', 'week', 'month', 'year')
   * @returns {Object} - Dữ liệu biểu đồ
   */
  schema.statics.getChartData = async function(timeRange = 'month') {
    // Xác định khoảng thời gian và định dạng nhóm
    const now = new Date();
    let startDate;
    let groupFormat;
    let dateFormat;

    switch (timeRange) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        groupFormat = { $dateToString: { format: '%H:00', date: '$transaction_date' } };
        dateFormat = '%H:00';
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$transaction_date' } };
        dateFormat = '%d/%m';
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$transaction_date' } };
        dateFormat = '%d/%m';
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        groupFormat = { $dateToString: { format: '%Y-%m', date: '$transaction_date' } };
        dateFormat = '%m/%Y';
        break;
      default:
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$transaction_date' } };
        dateFormat = '%d/%m';
    }

    // Thực hiện truy vấn dữ liệu biểu đồ
    const chartData = await this.aggregate([
      {
        $match: {
          transaction_date: { $gte: startDate, $lte: now }
        }
      },
      {
        $group: {
          _id: groupFormat,
          coinsIn: { $sum: { $cond: [{ $gt: ['$coin_change', 0] }, '$coin_change', 0] } },
          coinsOut: { $sum: { $cond: [{ $lt: ['$coin_change', 0] }, { $abs: '$coin_change' }, 0] } },
          netChange: { $sum: '$coin_change' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Định dạng kết quả cho biểu đồ
    const categories = chartData.map(item => item._id);
    const series = [
      {
        name: 'Xu vào',
        data: chartData.map(item => item.coinsIn)
      },
      {
        name: 'Xu ra',
        data: chartData.map(item => item.coinsOut)
      },
      {
        name: 'Thay đổi ròng',
        data: chartData.map(item => item.netChange)
      }
    ];

    return {
      categories,
      series,
      timeRange
    };
  };
  /**
   * Tạo giao dịch mới
   */
  schema.statics.createTransaction = async function(data) {
    const {
      user_id,
      description,
      type,
      coin_change,
      reference_type,
      reference_id,
      metadata,
      balance_after,
      transaction_id
    } = data;

    // Tạo mã giao dịch duy nhất với timestamp nếu không được cung cấp
    const finalTransactionId = transaction_id ||
      `${type.toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Xác định hướng giao dịch
    const direction = coin_change >= 0 ? 'in' : 'out';

    // Lấy số dư hiện tại nếu không được cung cấp
    let finalBalance = balance_after;
    if (finalBalance === undefined) {
      try {
        const User = mongoose.model('User');
        const user = await User.findById(user_id);
        if (user) {
          finalBalance = user.coin;
        }
      } catch (error) {
        console.error('Không thể lấy số dư hiện tại:', error);
      }
    }

    return this.create({
      user_id,
      transaction_id: finalTransactionId,
      description,
      transaction_date: new Date(),
      coin_change,
      type,
      direction,
      balance_after: finalBalance || 0,
      status: 'completed',
      reference_type: reference_type || '',
      reference_id: reference_id || null,
      metadata: metadata || {},
      // Trường tương thích ngược
      users_id: user_id,
      up_point: coin_change
    });
  };

  /**
   * Lấy tổng số xu theo loại giao dịch và khoảng thời gian
   */
  schema.statics.getTotalCoinsByType = async function(type, startDate, endDate) {
    const query = { type };

    if (startDate || endDate) {
      query.transaction_date = {};
      if (startDate) query.transaction_date.$gte = new Date(startDate);
      if (endDate) query.transaction_date.$lte = new Date(endDate);
    }

    const result = await this.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$coin_change' } } }
    ]);

    return result.length > 0 ? result[0].total : 0;
  };
};