/**
 * Tiện ích ghi log cho hoạt động liên quan đến xu
 * Giúp debug và xác định các vấn đề với dữ liệu xu
 */

// Format date cho log
const formatDate = (date) => {
  return new Date(date).toISOString().replace('T', ' ').substring(0, 19);
};

// Đếm số giao dịch theo coin_change và direction
const analyzeTransactions = (transactions = []) => {
  if (!transactions || transactions.length === 0) {
    return {
      total: 0,
      positiveCoinChange: 0,
      negativeCoinChange: 0,
      directionIn: 0,
      directionOut: 0,
      mismatchedDirection: 0
    };
  }
  
  const stats = {
    total: transactions.length,
    positiveCoinChange: 0,
    negativeCoinChange: 0,
    directionIn: 0,
    directionOut: 0,
    mismatchedDirection: 0
  };
  
  transactions.forEach(tx => {
    // Đếm theo coin_change
    if (tx.coin_change > 0) {
      stats.positiveCoinChange++;
    } else if (tx.coin_change < 0) {
      stats.negativeCoinChange++;
    }
    
    // Đếm theo direction
    if (tx.direction === 'in') {
      stats.directionIn++;
    } else if (tx.direction === 'out') {
      stats.directionOut++;
    }
    
    // Đếm các giao dịch có direction không khớp với coin_change
    if ((tx.coin_change > 0 && tx.direction !== 'in') || 
        (tx.coin_change < 0 && tx.direction !== 'out')) {
      stats.mismatchedDirection++;
    }
  });
  
  return stats;
};

const logTransactionDetails = (transactions = [], title = "Chi tiết giao dịch") => {
  if (!transactions || transactions.length === 0) {
    console.log(`${title}: Không có giao dịch`);
    return;
  }
  
  console.log(`===== ${title} (${transactions.length} giao dịch) =====`);
  const stats = analyzeTransactions(transactions);
  
  console.log("Phân tích giao dịch:");
  console.log(`- Tổng số: ${stats.total}`);
  console.log(`- Theo coin_change: Dương (${stats.positiveCoinChange}), Âm (${stats.negativeCoinChange})`);
  console.log(`- Theo direction: In (${stats.directionIn}), Out (${stats.directionOut})`);
  
  if (stats.mismatchedDirection > 0) {
    console.log(`- CẢNH BÁO: Có ${stats.mismatchedDirection} giao dịch có direction không khớp với coin_change`);
  }
  
  // Log mẫu một số giao dịch để kiểm tra
  const sampleSize = Math.min(5, transactions.length);
  console.log(`Mẫu ${sampleSize} giao dịch:`);
  
  transactions.slice(0, sampleSize).forEach((tx, index) => {
    console.log(`[${index + 1}] ID: ${tx._id}`);
    console.log(`    Ngày: ${formatDate(tx.transaction_date)}`);
    console.log(`    Xu: ${tx.coin_change} (direction: ${tx.direction})`);
    console.log(`    Loại: ${tx.type}, Mô tả: ${tx.description}`);
    
    // Hiển thị cảnh báo nếu không nhất quán
    if ((tx.coin_change > 0 && tx.direction !== 'in') || 
        (tx.coin_change < 0 && tx.direction !== 'out')) {
      console.log(`    [!] CẢNH BÁO: direction (${tx.direction}) không khớp với coin_change (${tx.coin_change})`);
    }
  });
};

module.exports = {
  formatDate,
  analyzeTransactions,
  logTransactionDetails
}; 