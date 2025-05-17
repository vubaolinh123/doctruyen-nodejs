const coinLogger = require('../../utils/coinLogger');

/**
 * Định nghĩa các hooks cho Transaction model
 * @param {Object} schema - Schema của Transaction
 */
module.exports = function(schema) {
  // Middleware pre-save để đảm bảo tương thích ngược
  schema.pre('save', function(next) {
    // Đảm bảo users_id luôn đồng bộ với user_id
    if (this.user_id && !this.users_id) {
      this.users_id = this.user_id;
    } else if (this.users_id && !this.user_id) {
      this.user_id = this.users_id;
    }

    // Đảm bảo up_point luôn đồng bộ với coin_change
    if (this.coin_change !== undefined && this.up_point === undefined) {
      this.up_point = this.coin_change;
    } else if (this.up_point !== undefined && this.coin_change === undefined) {
      this.coin_change = this.up_point;
    }

    next();
  });

  // Ghi log khi tạo giao dịch mới
  schema.post('save', function(doc) {
    const logData = {
      user_id: doc.user_id,
      transaction_id: doc.transaction_id,
      coin_change: doc.coin_change,
      type: doc.type,
      description: doc.description,
      transaction_date: doc.transaction_date
    };

    // Ghi log
    if (typeof coinLogger.logTransactionDetails === 'function') {
      coinLogger.logTransactionDetails([doc], 'Giao dịch mới được tạo');
    } else {
      console.log('Giao dịch mới được tạo:', logData);
    }
  });
};