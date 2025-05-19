const cron = require('node-cron');
const rankingService = require('../services/ranking/rankingService');
const StoryStats = require('../models/storyStats');
const Story = require('../models/story');
const moment = require('moment');

/**
 * Cập nhật thống kê truyện hàng ngày
 * Chạy vào 00:05 mỗi ngày
 */
const updateDailyStats = cron.schedule('5 0 * * *', async () => {
  try {
    console.log('[Cron] Updating daily stats...');
    
    // Lấy ngày hôm qua
    const yesterday = moment().subtract(1, 'days').startOf('day').toDate();
    const year = yesterday.getFullYear();
    const month = yesterday.getMonth();
    const day = yesterday.getDate();
    const week = moment(yesterday).isoWeek();
    
    // Lấy tất cả truyện có trạng thái active
    const stories = await Story.find({ status: true });
    
    // Tạo thống kê cho mỗi truyện
    const bulkOps = [];
    
    for (const story of stories) {
      // Tạo thống kê mới
      const statsData = {
        story_id: story._id,
        date: yesterday,
        views: 0, // Sẽ được cập nhật từ log thực tế
        unique_views: 0, // Sẽ được cập nhật từ log thực tế
        ratings_count: 0, // Sẽ được cập nhật từ log thực tế
        ratings_sum: 0, // Sẽ được cập nhật từ log thực tế
        comments_count: 0, // Sẽ được cập nhật từ log thực tế
        bookmarks_count: 0, // Sẽ được cập nhật từ log thực tế
        shares_count: 0, // Sẽ được cập nhật từ log thực tế
        day,
        month,
        year,
        week
      };
      
      bulkOps.push({
        updateOne: {
          filter: { 
            story_id: story._id,
            date: yesterday
          },
          update: { $set: statsData },
          upsert: true
        }
      });
    }
    
    // Thực hiện cập nhật hàng loạt
    if (bulkOps.length > 0) {
      await StoryStats.bulkWrite(bulkOps);
    }
    
    console.log(`[Cron] Updated daily stats for ${bulkOps.length} stories`);
  } catch (error) {
    console.error('[Cron] Error updating daily stats:', error);
  }
}, {
  scheduled: false
});

/**
 * Cập nhật xếp hạng theo ngày
 * Chạy vào 00:10 mỗi ngày
 */
const updateDailyRankings = cron.schedule('10 0 * * *', async () => {
  try {
    console.log('[Cron] Updating daily rankings...');
    await rankingService.updateDailyRankings();
    console.log('[Cron] Daily rankings updated successfully');
  } catch (error) {
    console.error('[Cron] Error updating daily rankings:', error);
  }
}, {
  scheduled: false
});

/**
 * Cập nhật xếp hạng theo tuần
 * Chạy vào 01:00 mỗi Thứ Hai
 */
const updateWeeklyRankings = cron.schedule('0 1 * * 1', async () => {
  try {
    console.log('[Cron] Updating weekly rankings...');
    await rankingService.updateWeeklyRankings();
    console.log('[Cron] Weekly rankings updated successfully');
  } catch (error) {
    console.error('[Cron] Error updating weekly rankings:', error);
  }
}, {
  scheduled: false
});

/**
 * Cập nhật xếp hạng theo tháng
 * Chạy vào 02:00 ngày đầu tiên của mỗi tháng
 */
const updateMonthlyRankings = cron.schedule('0 2 1 * *', async () => {
  try {
    console.log('[Cron] Updating monthly rankings...');
    await rankingService.updateMonthlyRankings();
    console.log('[Cron] Monthly rankings updated successfully');
  } catch (error) {
    console.error('[Cron] Error updating monthly rankings:', error);
  }
}, {
  scheduled: false
});

/**
 * Cập nhật xếp hạng toàn thời gian
 * Chạy vào 03:00 mỗi Chủ Nhật
 */
const updateAllTimeRankings = cron.schedule('0 3 * * 0', async () => {
  try {
    console.log('[Cron] Updating all-time rankings...');
    await rankingService.updateAllTimeRankings();
    console.log('[Cron] All-time rankings updated successfully');
  } catch (error) {
    console.error('[Cron] Error updating all-time rankings:', error);
  }
}, {
  scheduled: false
});

/**
 * Khởi động tất cả các cronjob
 */
const startAllCrons = () => {
  updateDailyStats.start();
  updateDailyRankings.start();
  updateWeeklyRankings.start();
  updateMonthlyRankings.start();
  updateAllTimeRankings.start();
  
  console.log('[Cron] All ranking cron jobs started');
};

module.exports = {
  updateDailyStats,
  updateDailyRankings,
  updateWeeklyRankings,
  updateMonthlyRankings,
  updateAllTimeRankings,
  startAllCrons
};
