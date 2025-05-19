const rankingCron = require('./rankingCron');

/**
 * Khởi động tất cả các cronjob
 */
const startAllCrons = () => {
  // Khởi động cronjob xếp hạng
  rankingCron.startAllCrons();
  
  console.log('[Cron] All cron jobs started');
};

module.exports = {
  startAllCrons
};
