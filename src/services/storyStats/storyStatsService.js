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


      // Chuyển đổi storyId thành ObjectId
      const storyObjectId = new mongoose.Types.ObjectId(storyId);

      // Tổng hợp lượt xem từ tất cả các bản ghi StoryStats
      // Chuyển đổi storyId thành string để so sánh
      const storyIdStr = storyId.toString();

      // Kiểm tra xem có bản ghi StoryStats nào cho truyện này không
      const allStats = await StoryStats.find({ story_id: storyObjectId });

      const result = await StoryStats.aggregate([
        { $match: { story_id: storyObjectId } },
        { $group: { _id: null, totalViews: { $sum: '$views' } } }
      ]);


      // Nếu không có kết quả, trả về 0
      if (!result || result.length === 0) {

        // Kiểm tra xem có bản ghi StoryStats nào cho truyện này không
        const statsCount = await StoryStats.countDocuments({ story_id: storyObjectId });

        // Lấy một bản ghi mẫu để kiểm tra
        if (statsCount > 0) {
          const sampleStat = await StoryStats.findOne({ story_id: storyObjectId });
        }

        return 0;
      }

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

      // Import UserRating model
      const UserRating = require('../../models/userRating');

      // Chuyển đổi storyId thành ObjectId
      const storyObjectId = new mongoose.Types.ObjectId(storyId);

      // Tính toán thống kê đánh giá chính xác từ UserRating collection
      const result = await UserRating.aggregate([
        { $match: { story_id: storyObjectId } },
        {
          $group: {
            _id: null,
            ratingsCount: { $sum: 1 }, // Đếm số lượng user đã rating
            ratingsSum: { $sum: '$rating' }, // Tổng điểm rating
            avgRating: { $avg: '$rating' } // Trung bình rating
          }
        }
      ]);

      // Nếu không có kết quả, trả về giá trị mặc định
      if (!result || result.length === 0) {
        return { ratingsCount: 0, ratingsSum: 0, averageRating: 0 };
      }

      const { ratingsCount, ratingsSum, avgRating } = result[0];

      // Đảm bảo average_rating không vượt quá 10 và làm tròn
      const averageRating = Math.min(10, Math.max(0, Math.round(avgRating * 100) / 100));

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
