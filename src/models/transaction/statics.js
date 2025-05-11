const mongoose = require('mongoose');

/**
 * Định nghĩa các static methods cho Transaction model
 * @param {Object} schema - Schema của Transaction
 */
module.exports = function(schema) {
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