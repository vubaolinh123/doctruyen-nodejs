const StoryStats = require('../../models/storyStats');
const mongoose = require('mongoose');
const moment = require('moment');

/**
 * Service xử lý logic nghiệp vụ cho thống kê truyện
 */
class StoryStatsService {
  /**
   * Lấy tổng lượt xem của một truyện
   * @param {string} storyId - ID của truyện
   * @returns {Promise<number>} - Tổng lượt xem
   */
  async getTotalViews(storyId) {
    try {
      // Kiểm tra storyId có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        throw new Error('Invalid story ID');
      }

      console.log(`[StoryStatsService] Lấy tổng lượt xem cho truyện ${storyId}`);

      // Chuyển đổi storyId thành ObjectId
      const storyObjectId = new mongoose.Types.ObjectId(storyId);

      // Tổng hợp lượt xem từ tất cả các bản ghi StoryStats
      // Chuyển đổi storyId thành string để so sánh
      const storyIdStr = storyId.toString();
      console.log(`[StoryStatsService] Tìm kiếm StoryStats với story_id: ${storyIdStr}`);

      // Kiểm tra xem có bản ghi StoryStats nào cho truyện này không
      const allStats = await StoryStats.find({ story_id: storyObjectId });
      console.log(`[StoryStatsService] Số lượng bản ghi StoryStats tìm thấy: ${allStats.length}`);

      if (allStats.length > 0) {
        console.log(`[StoryStatsService] Mẫu bản ghi đầu tiên:`, JSON.stringify(allStats[0]));
      }

      const result = await StoryStats.aggregate([
        { $match: { story_id: storyObjectId } },
        { $group: { _id: null, totalViews: { $sum: '$views' } } }
      ]);

      console.log(`[StoryStatsService] Kết quả truy vấn lượt xem:`, JSON.stringify(result));

      // Nếu không có kết quả, trả về 0
      if (!result || result.length === 0) {
        console.log(`[StoryStatsService] Không có dữ liệu lượt xem cho truyện ${storyId}`);

        // Kiểm tra xem có bản ghi StoryStats nào cho truyện này không
        const statsCount = await StoryStats.countDocuments({ story_id: storyObjectId });
        console.log(`[StoryStatsService] Số lượng bản ghi StoryStats cho truyện ${storyId}: ${statsCount}`);

        // Lấy một bản ghi mẫu để kiểm tra
        if (statsCount > 0) {
          const sampleStat = await StoryStats.findOne({ story_id: storyObjectId });
          console.log(`[StoryStatsService] Bản ghi StoryStats mẫu:`, JSON.stringify(sampleStat));
        }

        return 0;
      }

      console.log(`[StoryStatsService] Tổng lượt xem cho truyện ${storyId}: ${result[0].totalViews}`);
      return result[0].totalViews;
    } catch (error) {
      console.error(`[StoryStatsService] Error getting total views for story ${storyId}:`, error);
      throw error;
    }
  }

  /**
   * Lấy tổng lượt xem của một truyện trong một khoảng thời gian
   * @param {string} storyId - ID của truyện
   * @param {string} timeRange - Khoảng thời gian ('day', 'week', 'month', 'year', 'all')
   * @returns {Promise<number>} - Tổng lượt xem
   */
  async getViewsByTimeRange(storyId, timeRange = 'all') {
    try {
      // Kiểm tra storyId có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        throw new Error('Invalid story ID');
      }

      // Xác định khoảng thời gian
      let startDate;
      const now = moment();

      switch (timeRange) {
        case 'day':
          startDate = now.clone().startOf('day');
          break;
        case 'week':
          startDate = now.clone().subtract(7, 'days');
          break;
        case 'month':
          startDate = now.clone().subtract(30, 'days');
          break;
        case 'year':
          startDate = now.clone().subtract(365, 'days');
          break;
        case 'all':
        default:
          startDate = moment(0); // Từ đầu thời gian
          break;
      }

      // Tổng hợp lượt xem từ các bản ghi StoryStats trong khoảng thời gian
      console.log(`[StoryStatsService] Lấy lượt xem theo khoảng thời gian ${timeRange} cho truyện ${storyId}`);

      // Chuyển đổi storyId thành ObjectId
      const storyObjectId = new mongoose.Types.ObjectId(storyId);

      const result = await StoryStats.aggregate([
        {
          $match: {
            story_id: storyObjectId,
            date: { $gte: startDate.toDate() }
          }
        },
        { $group: { _id: null, totalViews: { $sum: '$views' } } }
      ]);

      // Nếu không có kết quả, trả về 0
      if (!result || result.length === 0) {
        return 0;
      }

      return result[0].totalViews;
    } catch (error) {
      console.error(`Error getting views by time range for story ${storyId}:`, error);
      throw error;
    }
  }

  /**
   * Lấy thống kê đánh giá của một truyện
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Object>} - Thống kê đánh giá
   */
  async getRatingStats(storyId) {
    try {
      // Kiểm tra storyId có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        throw new Error('Invalid story ID');
      }

      // Tổng hợp thông tin đánh giá từ tất cả các bản ghi StoryStats
      console.log(`[StoryStatsService] Lấy thống kê đánh giá cho truyện ${storyId}`);

      // Chuyển đổi storyId thành ObjectId
      const storyObjectId = new mongoose.Types.ObjectId(storyId);
      console.log(`[StoryStatsService] Story ID (ObjectId): ${storyObjectId}`);

      const result = await StoryStats.aggregate([
        { $match: { story_id: storyObjectId } },
        {
          $group: {
            _id: null,
            ratingsCount: { $sum: '$ratings_count' },
            ratingsSum: { $sum: '$ratings_sum' }
          }
        }
      ]);

      // Nếu không có kết quả, trả về giá trị mặc định
      if (!result || result.length === 0) {
        return { ratingsCount: 0, ratingsSum: 0, averageRating: 0 };
      }

      const { ratingsCount, ratingsSum } = result[0];
      const averageRating = ratingsCount > 0 ? ratingsSum / ratingsCount : 0;

      return { ratingsCount, ratingsSum, averageRating };
    } catch (error) {
      console.error(`Error getting rating stats for story ${storyId}:`, error);
      throw error;
    }
  }

  /**
   * Lấy tất cả thống kê của một truyện
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Object>} - Tất cả thống kê
   */
  async getAllStats(storyId) {
    try {
      // Kiểm tra storyId có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        throw new Error('Invalid story ID');
      }

      // Lấy tổng lượt xem
      const totalViews = await this.getTotalViews(storyId);

      // Lấy thống kê đánh giá
      const ratingStats = await this.getRatingStats(storyId);

      // Lấy lượt xem theo thời gian
      const viewsByDay = await this.getViewsByTimeRange(storyId, 'day');
      const viewsByWeek = await this.getViewsByTimeRange(storyId, 'week');
      const viewsByMonth = await this.getViewsByTimeRange(storyId, 'month');
      const viewsByYear = await this.getViewsByTimeRange(storyId, 'year');

      // Lấy thống kê chi tiết theo ngày
      const today = moment().startOf('day').toDate();
      console.log(`[StoryStatsService] Lấy thống kê chi tiết theo ngày cho truyện ${storyId}`);

      // Chuyển đổi storyId thành ObjectId
      const storyObjectId = new mongoose.Types.ObjectId(storyId);

      const dailyStats = await StoryStats.findOne({
        story_id: storyObjectId,
        date: today
      });

      return {
        totalViews,
        ratings: ratingStats,
        viewsByTimeRange: {
          day: viewsByDay,
          week: viewsByWeek,
          month: viewsByMonth,
          year: viewsByYear,
          all: totalViews
        },
        dailyStats: dailyStats || {
          views: 0,
          unique_views: 0,
          ratings_count: 0,
          ratings_sum: 0,
          comments_count: 0,
          bookmarks_count: 0,
          shares_count: 0
        }
      };
    } catch (error) {
      console.error(`Error getting all stats for story ${storyId}:`, error);
      throw error;
    }
  }
}

module.exports = new StoryStatsService();
