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
    coinLogger.logTransactionDetails(invalidIn, "Giao dịch direction=in nhưng coin_change<0");
  }
  
  if (invalidOut.length > 0) {
    coinLogger.logTransactionDetails(invalidOut, "Giao dịch direction=out nhưng coin_change>0");
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
  const Customer = mongoose.model('Customer');
  
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
  
  // Lấy tổng xu hiện tại của các khách hàng
  const customerAgg = await Customer.aggregate([
    {
      $group: {
        _id: null,
        totalCoins: { $sum: '$coin' },
        totalCoinTotal: { $sum: '$coin_total' },
        totalCoinSpent: { $sum: '$coin_spent' },
        customerCount: { $sum: 1 }
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
        transactionCount: { $sum: 1 }
      }
    }
  ]);
  
  const results = {
    invalidDirections,
    customerStats: customerAgg.length > 0 ? customerAgg[0] : { totalCoins: 0, customerCount: 0 },
    transactionStats: transactionAgg.length > 0 ? transactionAgg[0] : { totalReceived: 0, totalSpent: 0, transactionCount: 0 }
  };
  
  console.log("Kết quả kiểm tra dữ liệu xu:");
  console.log(`- Số giao dịch có direction không khớp: ${results.invalidDirections}`);
  console.log(`- Thống kê khách hàng: ${results.customerStats.customerCount} khách hàng, ${results.customerStats.totalCoins} xu tổng`);
  console.log(`- Thống kê giao dịch: ${results.transactionStats.transactionCount} giao dịch`);
  console.log(`  + Tổng xu đã nhận: ${results.transactionStats.totalReceived}`);
  console.log(`  + Tổng xu đã tiêu: ${results.transactionStats.totalSpent}`);
  
  // Log các giao dịch không hợp lệ
  if (invalidTransactionSamples.length > 0) {
    coinLogger.logTransactionDetails(invalidTransactionSamples, "Mẫu giao dịch direction không khớp với coin_change");
  }
  
  return results;
}

// Export các hàm
module.exports = {
  repairTransactionDirection,
  checkCoinDataConsistency
}; 