/**
 * Service khởi tạo dữ liệu ranking khi server startup
 * Đảm bảo luôn có dữ liệu ranking sẵn sàng khi server khởi động
 */

const rankingService = require('./rankingService');
const StoryRankings = require('../../models/storyRankings');
const moment = require('moment');

class RankingInitializer {
  /**
   * Khởi tạo dữ liệu ranking khi server startup
   * @returns {Promise<Object>} - Kết quả khởi tạo
   */
  static async initializeOnStartup() {
    try {
      console.log('\x1b[33m%s\x1b[0m', '[Ranking Initializer] Starting ranking initialization...');
      
      const today = moment().startOf('day').toDate();
      
      // Kiểm tra dữ liệu ranking hiện có
      const rankingStats = await this.checkExistingRankings(today);
      
      // Quyết định có cần khởi tạo không
      const needsInitialization = this.shouldInitialize(rankingStats);
      
      if (needsInitialization) {
        console.log('\x1b[36m%s\x1b[0m', '[Ranking Initializer] Initializing missing rankings...');
        const result = await this.createInitialRankings();
        
        console.log('\x1b[32m%s\x1b[0m', '[Ranking Initializer] ✓ Ranking initialization completed successfully');
        return result;
      } else {
        console.log('\x1b[32m%s\x1b[0m', '[Ranking Initializer] ✓ All rankings already exist, skipping initialization');
        return {
          success: true,
          created: false,
          message: 'All rankings already exist for today',
          stats: rankingStats
        };
      }
    } catch (error) {
      console.error('\x1b[31m%s\x1b[0m', '[Ranking Initializer] ✗ Error during ranking initialization:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Kiểm tra dữ liệu ranking hiện có
   * @param {Date} date - Ngày cần kiểm tra
   * @returns {Promise<Object>} - Thống kê dữ liệu ranking
   */
  static async checkExistingRankings(date) {
    try {
      const startOfDay = moment(date).startOf('day').toDate();
      const endOfDay = moment(date).endOf('day').toDate();

      // Đếm số lượng ranking theo từng loại
      const [dailyCount, weeklyCount, monthlyCount, allTimeCount] = await Promise.all([
        StoryRankings.countDocuments({
          date: { $gte: startOfDay, $lte: endOfDay },
          daily_rank: { $gt: 0 }
        }),
        StoryRankings.countDocuments({
          date: { $gte: startOfDay, $lte: endOfDay },
          weekly_rank: { $gt: 0 }
        }),
        StoryRankings.countDocuments({
          date: { $gte: startOfDay, $lte: endOfDay },
          monthly_rank: { $gt: 0 }
        }),
        StoryRankings.countDocuments({
          date: { $gte: startOfDay, $lte: endOfDay },
          all_time_rank: { $gt: 0 }
        })
      ]);

      const stats = {
        daily: dailyCount,
        weekly: weeklyCount,
        monthly: monthlyCount,
        allTime: allTimeCount,
        total: dailyCount + weeklyCount + monthlyCount + allTimeCount
      };

      console.log('\x1b[36m%s\x1b[0m', `[Ranking Initializer] Current ranking stats:`, stats);
      return stats;
    } catch (error) {
      console.error('[Ranking Initializer] Error checking existing rankings:', error);
      throw error;
    }
  }

  /**
   * Quyết định có cần khởi tạo ranking không
   * @param {Object} stats - Thống kê ranking hiện có
   * @returns {boolean} - True nếu cần khởi tạo
   */
  static shouldInitialize(stats) {
    // Nếu bất kỳ loại ranking nào chưa có dữ liệu thì cần khởi tạo
    return stats.daily === 0 || stats.weekly === 0 || stats.monthly === 0 || stats.allTime === 0;
  }

  /**
   * Tạo dữ liệu ranking ban đầu
   * @returns {Promise<Object>} - Kết quả tạo ranking
   */
  static async createInitialRankings() {
    try {
      console.log('\x1b[36m%s\x1b[0m', '[Ranking Initializer] Creating initial rankings...');
      
      // Tạo ranking theo thứ tự: daily -> weekly -> monthly -> all-time
      const results = {};
      
      console.log('\x1b[36m%s\x1b[0m', '[Ranking Initializer] - Creating daily rankings...');
      results.daily = await rankingService.updateDailyRankings();
      
      console.log('\x1b[36m%s\x1b[0m', '[Ranking Initializer] - Creating weekly rankings...');
      results.weekly = await rankingService.updateWeeklyRankings();
      
      console.log('\x1b[36m%s\x1b[0m', '[Ranking Initializer] - Creating monthly rankings...');
      results.monthly = await rankingService.updateMonthlyRankings();
      
      console.log('\x1b[36m%s\x1b[0m', '[Ranking Initializer] - Creating all-time rankings...');
      results.allTime = await rankingService.updateAllTimeRankings();

      // Log kết quả
      console.log('\x1b[32m%s\x1b[0m', '[Ranking Initializer] ✓ Initial rankings created:');
      console.log('\x1b[32m%s\x1b[0m', `  - Daily: ${results.daily} stories`);
      console.log('\x1b[32m%s\x1b[0m', `  - Weekly: ${results.weekly} stories`);
      console.log('\x1b[32m%s\x1b[0m', `  - Monthly: ${results.monthly} stories`);
      console.log('\x1b[32m%s\x1b[0m', `  - All-time: ${results.allTime} stories`);

      return {
        success: true,
        created: true,
        counts: results
      };
    } catch (error) {
      console.error('[Ranking Initializer] Error creating initial rankings:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra tính khả dụng của API ranking
   * @returns {Promise<Object>} - Kết quả kiểm tra
   */
  static async validateRankingAPIs() {
    try {
      console.log('\x1b[36m%s\x1b[0m', '[Ranking Initializer] Validating ranking APIs...');
      
      const today = moment().startOf('day').toDate();
      
      // Kiểm tra từng loại ranking
      const [dailyRankings, weeklyRankings, monthlyRankings, allTimeRankings] = await Promise.all([
        StoryRankings.findDailyRankings(today, 1),
        StoryRankings.findWeeklyRankings(today, 1),
        StoryRankings.findMonthlyRankings(today, 1),
        StoryRankings.findAllTimeRankings(today, 1)
      ]);

      const validation = {
        daily: dailyRankings.length > 0,
        weekly: weeklyRankings.length > 0,
        monthly: monthlyRankings.length > 0,
        allTime: allTimeRankings.length > 0
      };

      const allValid = Object.values(validation).every(v => v === true);
      
      if (allValid) {
        console.log('\x1b[32m%s\x1b[0m', '[Ranking Initializer] ✓ All ranking APIs are ready');
      } else {
        console.log('\x1b[31m%s\x1b[0m', '[Ranking Initializer] ✗ Some ranking APIs are not ready:', validation);
      }

      return {
        success: allValid,
        validation
      };
    } catch (error) {
      console.error('[Ranking Initializer] Error validating ranking APIs:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = RankingInitializer;
