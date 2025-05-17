/**
 * Công cụ sửa chữa dữ liệu xu
 * Dùng để sửa các trường hợp direction không khớp với coin_change
 */

const mongoose = require('mongoose');
const coinLogger = require('./coinLogger');

/**
 * Sửa chữa các giao dịch có direction không khớp với coin_change
 * @returns {Promise<Object>} Thống kê các giao dịch đã sửa
 */
async function repairTransactionDirection() {
  const Transaction = mongoose.model('Transaction');

  console.log("Bắt đầu quá trình sửa chữa direction...");

  // Tìm các giao dịch có direction không khớp với coin_change
  const invalidIn = await Transaction.find({
    $and: [
      { direction: 'in' },
      { coin_change: { $lt: 0 } }
    ]
  });

  const invalidOut = await Transaction.find({
    $and: [
      { direction: 'out' },
      { coin_change: { $gt: 0 } }
    ]
  });

  console.log(`Tìm thấy ${invalidIn.length} giao dịch direction=in nhưng coin_change<0`);
  console.log(`Tìm thấy ${invalidOut.length} giao dịch direction=out nhưng coin_change>0`);

  // Log các giao dịch không hợp lệ để kiểm tra
  if (invalidIn.length > 0) {
    if (typeof coinLogger.logTransactionDetails === 'function') {
      coinLogger.logTransactionDetails(invalidIn, "Giao dịch direction=in nhưng coin_change<0");
    } else {
      console.log("Giao dịch direction=in nhưng coin_change<0:", invalidIn.length);
    }
  }

  if (invalidOut.length > 0) {
    if (typeof coinLogger.logTransactionDetails === 'function') {
      coinLogger.logTransactionDetails(invalidOut, "Giao dịch direction=out nhưng coin_change>0");
    } else {
      console.log("Giao dịch direction=out nhưng coin_change>0:", invalidOut.length);
    }
  }

  // Sửa các giao dịch không hợp lệ
  let fixedCount = 0;

  for (const tx of invalidIn) {
    tx.direction = 'out';
    await tx.save();
    fixedCount++;

    if (fixedCount % 10 === 0) {
      console.log(`Đã sửa ${fixedCount} giao dịch...`);
    }
  }

  for (const tx of invalidOut) {
    tx.direction = 'in';
    await tx.save();
    fixedCount++;

    if (fixedCount % 10 === 0) {
      console.log(`Đã sửa ${fixedCount} giao dịch...`);
    }
  }

  console.log(`Hoàn thành sửa chữa: Đã sửa ${fixedCount} giao dịch`);

  return {
    totalInvalidTransactions: invalidIn.length + invalidOut.length,
    fixedTransactions: fixedCount,
    invalidIn: invalidIn.length,
    invalidOut: invalidOut.length
  };
}

/**
 * Kiểm tra tính nhất quán của dữ liệu xu
 * @returns {Promise<Object>} Thống kê tình trạng dữ liệu
 */
async function checkCoinDataConsistency() {
  const Transaction = mongoose.model('Transaction');
  const User = mongoose.model('User');

  console.log("Kiểm tra tính nhất quán của dữ liệu xu...");

  // Kiểm tra các giao dịch có direction không khớp với coin_change
  const invalidDirections = await Transaction.countDocuments({
    $or: [
      { $and: [{ direction: 'in' }, { coin_change: { $lt: 0 } }] },
      { $and: [{ direction: 'out' }, { coin_change: { $gt: 0 } }] }
    ]
  });

  // Lấy mẫu các giao dịch không hợp lệ
  const invalidTransactionSamples = await Transaction.find({
    $or: [
      { $and: [{ direction: 'in' }, { coin_change: { $lt: 0 } }] },
      { $and: [{ direction: 'out' }, { coin_change: { $gt: 0 } }] }
    ]
  }).limit(5);

  // Lấy tổng xu hiện tại của các người dùng
  const userAgg = await User.aggregate([
    {
      $group: {
        _id: null,
        totalCoins: { $sum: '$coin' },
        totalCoinTotal: { $sum: '$coin_total' },
        totalCoinSpent: { $sum: '$coin_spent' },
        userCount: { $sum: 1 }
      }
    }
  ]);

  // Lấy tổng xu đã thay đổi từ các giao dịch
  const transactionAgg = await Transaction.aggregate([
    {
      $group: {
        _id: null,
        totalReceived: { $sum: { $cond: [{ $gt: ['$coin_change', 0] }, '$coin_change', 0] } },
        totalSpent: { $sum: { $cond: [{ $lt: ['$coin_change', 0] }, { $abs: '$coin_change' }, 0] } },
        transactionCount: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user_id' }
      }
    },
    {
      $project: {
        _id: 0,
        totalReceived: 1,
        totalSpent: 1,
        transactionCount: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        netChange: { $subtract: ['$totalReceived', '$totalSpent'] }
      }
    }
  ]);

  // Lấy thống kê theo loại giao dịch
  const typeStats = await Transaction.aggregate([
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalCoins: { $sum: { $cond: [{ $gt: ['$coin_change', 0] }, '$coin_change', { $multiply: ['$coin_change', -1] }] } }
      }
    },
    {
      $project: {
        _id: 0,
        type: '$_id',
        count: 1,
        totalCoins: 1
      }
    }
  ]);

  // Chuyển đổi mảng thành đối tượng
  const byType = {};
  typeStats.forEach(stat => {
    byType[stat.type] = {
      count: stat.count,
      totalCoins: stat.totalCoins
    };
  });

  // Kiểm tra số dư xu của người dùng
  const mismatchedBalances = await checkUserBalances();

  const results = {
    transactionStats: transactionAgg.length > 0 ? {
      transactionCount: transactionAgg[0].transactionCount,
      totalCoinsIn: transactionAgg[0].totalReceived,
      totalCoinsOut: transactionAgg[0].totalSpent,
      netChange: transactionAgg[0].netChange,
      uniqueUsers: transactionAgg[0].uniqueUsers
    } : {
      transactionCount: 0,
      totalCoinsIn: 0,
      totalCoinsOut: 0,
      netChange: 0,
      uniqueUsers: 0
    },
    customerStats: userAgg.length > 0 ? {
      customerCount: userAgg[0].userCount,
      totalCoins: userAgg[0].totalCoins,
      totalCoinTotal: userAgg[0].totalCoinTotal,
      totalCoinSpent: userAgg[0].totalCoinSpent
    } : {
      customerCount: 0,
      totalCoins: 0,
      totalCoinTotal: 0,
      totalCoinSpent: 0
    },
    byType,
    invalidDirections,
    mismatchedBalances,
    timeRange: 'all'
  };

  console.log("Kết quả kiểm tra dữ liệu xu:");
  console.log(`- Số giao dịch có direction không khớp: ${results.invalidDirections}`);
  console.log(`- Số người dùng có số dư không khớp: ${results.mismatchedBalances}`);
  console.log(`- Thống kê người dùng: ${results.customerStats.customerCount} người dùng, ${results.customerStats.totalCoins} xu tổng`);
  console.log(`- Thống kê giao dịch: ${results.transactionStats.transactionCount} giao dịch`);
  console.log(`  + Tổng xu đã nhận: ${results.transactionStats.totalCoinsIn}`);
  console.log(`  + Tổng xu đã tiêu: ${results.transactionStats.totalCoinsOut}`);

  // Log các giao dịch không hợp lệ
  if (invalidTransactionSamples.length > 0) {
    if (typeof coinLogger.logTransactionDetails === 'function') {
      coinLogger.logTransactionDetails(invalidTransactionSamples, "Mẫu giao dịch direction không khớp với coin_change");
    } else {
      console.log("Mẫu giao dịch direction không khớp với coin_change:", invalidTransactionSamples.length);
    }
  }

  return results;
}

/**
 * Kiểm tra số dư xu của người dùng
 * @returns {Promise<number>} Số lượng người dùng có số dư không khớp
 */
async function checkUserBalances() {
  const User = mongoose.model('User');
  const Transaction = mongoose.model('Transaction');

  // Lấy tất cả người dùng
  const users = await User.find().select('_id name email coin coin_total coin_spent');
  let mismatchCount = 0;

  for (const user of users) {
    // Tính toán số dư dựa trên giao dịch
    const transactions = await Transaction.find({ user_id: user._id });

    let calculatedBalance = 0;
    let calculatedTotal = 0;
    let calculatedSpent = 0;

    for (const tx of transactions) {
      if (tx.coin_change > 0) {
        calculatedTotal += tx.coin_change;
        calculatedBalance += tx.coin_change;
      } else {
        calculatedSpent += Math.abs(tx.coin_change);
        calculatedBalance += tx.coin_change;
      }
    }

    // So sánh với số dư hiện tại
    if (user.coin !== calculatedBalance ||
        user.coin_total !== calculatedTotal ||
        user.coin_spent !== calculatedSpent) {
      mismatchCount++;

      if (mismatchCount <= 5) {
        console.log(`Người dùng ${user.name || user.email} (${user._id}) có số dư không khớp:`);
        console.log(`  Hiện tại: coin=${user.coin}, total=${user.coin_total}, spent=${user.coin_spent}`);
        console.log(`  Tính toán: coin=${calculatedBalance}, total=${calculatedTotal}, spent=${calculatedSpent}`);
      }
    }
  }

  console.log(`Tìm thấy ${mismatchCount}/${users.length} người dùng có số dư không khớp`);
  return mismatchCount;
}

/**
 * Sửa chữa số dư xu của người dùng
 * @param {string} adminId - ID của admin thực hiện sửa chữa
 * @returns {Promise<Object>} Kết quả sửa chữa
 */
async function repairAllUserCoins(adminId) {
  const User = mongoose.model('User');
  const Transaction = mongoose.model('Transaction');

  console.log(`Bắt đầu sửa chữa số dư xu của người dùng (admin: ${adminId})...`);

  // Lấy tất cả người dùng
  const users = await User.find().select('_id name email coin coin_total coin_spent');
  let fixedCount = 0;

  for (const user of users) {
    // Tính toán số dư dựa trên giao dịch
    const transactions = await Transaction.find({ user_id: user._id });

    let calculatedBalance = 0;
    let calculatedTotal = 0;
    let calculatedSpent = 0;

    for (const tx of transactions) {
      if (tx.coin_change > 0) {
        calculatedTotal += tx.coin_change;
        calculatedBalance += tx.coin_change;
      } else {
        calculatedSpent += Math.abs(tx.coin_change);
        calculatedBalance += tx.coin_change;
      }
    }

    // So sánh với số dư hiện tại
    if (user.coin !== calculatedBalance ||
        user.coin_total !== calculatedTotal ||
        user.coin_spent !== calculatedSpent) {

      console.log(`Sửa chữa số dư cho người dùng ${user.name || user.email} (${user._id}):`);
      console.log(`  Trước: coin=${user.coin}, total=${user.coin_total}, spent=${user.coin_spent}`);
      console.log(`  Sau: coin=${calculatedBalance}, total=${calculatedTotal}, spent=${calculatedSpent}`);

      // Cập nhật số dư
      user.coin = calculatedBalance;
      user.coin_total = calculatedTotal;
      user.coin_spent = calculatedSpent;
      await user.save();

      // Tạo giao dịch ghi nhận việc sửa chữa
      if (typeof Transaction.createTransaction === 'function') {
        await Transaction.createTransaction({
          user_id: user._id,
          description: 'Sửa chữa số dư xu tự động',
          type: 'system',
          coin_change: 0, // Không thay đổi số dư
          balance_after: calculatedBalance,
          metadata: {
            admin_id: adminId,
            old_balance: user.coin,
            old_total: user.coin_total,
            old_spent: user.coin_spent,
            action: 'repair_balance'
          }
        });
      }

      fixedCount++;
    }
  }

  console.log(`Hoàn thành sửa chữa: Đã sửa ${fixedCount}/${users.length} người dùng`);

  return {
    total: users.length,
    fixed: fixedCount
  };
}

// Export các hàm
module.exports = {
  repairTransactionDirection,
  checkCoinDataConsistency,
  repairAllUserCoins
};