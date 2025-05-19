/**
 * Định nghĩa các static methods cho StoryStats model
 * @param {Object} schema - Schema của StoryStats model
 */
const setupStatics = (schema) => {
  /**
   * Lấy thống kê của một truyện trong một ngày cụ thể
   * @param {string} storyId - ID của truyện
   * @param {Date} date - Ngày cần lấy thống kê
   * @returns {Promise<Object>} - Thống kê của truyện
   */
  schema.statics.findByStoryAndDate = function(storyId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.findOne({
      story_id: storyId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });
  };
  
  /**
   * Lấy thống kê của một truyện trong một khoảng thời gian
   * @param {string} storyId - ID của truyện
   * @param {Date} startDate - Ngày bắt đầu
   * @param {Date} endDate - Ngày kết thúc
   * @returns {Promise<Array>} - Danh sách thống kê của truyện
   */
  schema.statics.findByStoryAndDateRange = function(storyId, startDate, endDate) {
    return this.find({
      story_id: storyId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: 1 });
  };
  
  /**
   * Lấy thống kê của một truyện trong một tuần
   * @param {string} storyId - ID của truyện
   * @param {number} year - Năm
   * @param {number} week - Tuần trong năm (1-53)
   * @returns {Promise<Array>} - Danh sách thống kê của truyện
   */
  schema.statics.findByStoryAndWeek = function(storyId, year, week) {
    return this.find({
      story_id: storyId,
      year,
      week
    }).sort({ date: 1 });
  };
  
  /**
   * Lấy thống kê của một truyện trong một tháng
   * @param {string} storyId - ID của truyện
   * @param {number} year - Năm
   * @param {number} month - Tháng (0-11)
   * @returns {Promise<Array>} - Danh sách thống kê của truyện
   */
  schema.statics.findByStoryAndMonth = function(storyId, year, month) {
    return this.find({
      story_id: storyId,
      year,
      month
    }).sort({ date: 1 });
  };
  
  /**
   * Tổng hợp thống kê của tất cả truyện trong một ngày
   * @param {Date} date - Ngày cần tổng hợp
   * @returns {Promise<Array>} - Danh sách tổng hợp thống kê
   */
  schema.statics.aggregateByDate = function(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.aggregate([
      {
        $match: {
          date: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }
      },
      {
        $group: {
          _id: "$story_id",
          views: { $sum: "$views" },
          unique_views: { $sum: "$unique_views" },
          ratings_count: { $sum: "$ratings_count" },
          ratings_sum: { $sum: "$ratings_sum" },
          comments_count: { $sum: "$comments_count" },
          bookmarks_count: { $sum: "$bookmarks_count" },
          shares_count: { $sum: "$shares_count" }
        }
      }
    ]);
  };
  
  /**
   * Tổng hợp thống kê của tất cả truyện trong một tuần
   * @param {number} year - Năm
   * @param {number} week - Tuần trong năm (1-53)
   * @returns {Promise<Array>} - Danh sách tổng hợp thống kê
   */
  schema.statics.aggregateByWeek = function(year, week) {
    return this.aggregate([
      {
        $match: {
          year,
          week
        }
      },
      {
        $group: {
          _id: "$story_id",
          views: { $sum: "$views" },
          unique_views: { $sum: "$unique_views" },
          ratings_count: { $sum: "$ratings_count" },
          ratings_sum: { $sum: "$ratings_sum" },
          comments_count: { $sum: "$comments_count" },
          bookmarks_count: { $sum: "$bookmarks_count" },
          shares_count: { $sum: "$shares_count" }
        }
      }
    ]);
  };
  
  /**
   * Tổng hợp thống kê của tất cả truyện trong một tháng
   * @param {number} year - Năm
   * @param {number} month - Tháng (0-11)
   * @returns {Promise<Array>} - Danh sách tổng hợp thống kê
   */
  schema.statics.aggregateByMonth = function(year, month) {
    return this.aggregate([
      {
        $match: {
          year,
          month
        }
      },
      {
        $group: {
          _id: "$story_id",
          views: { $sum: "$views" },
          unique_views: { $sum: "$unique_views" },
          ratings_count: { $sum: "$ratings_count" },
          ratings_sum: { $sum: "$ratings_sum" },
          comments_count: { $sum: "$comments_count" },
          bookmarks_count: { $sum: "$bookmarks_count" },
          shares_count: { $sum: "$shares_count" }
        }
      }
    ]);
  };
  
  /**
   * Tổng hợp thống kê của tất cả truyện trong toàn thời gian
   * @returns {Promise<Array>} - Danh sách tổng hợp thống kê
   */
  schema.statics.aggregateAllTime = function() {
    return this.aggregate([
      {
        $group: {
          _id: "$story_id",
          views: { $sum: "$views" },
          unique_views: { $sum: "$unique_views" },
          ratings_count: { $sum: "$ratings_count" },
          ratings_sum: { $sum: "$ratings_sum" },
          comments_count: { $sum: "$comments_count" },
          bookmarks_count: { $sum: "$bookmarks_count" },
          shares_count: { $sum: "$shares_count" }
        }
      }
    ]);
  };
};

module.exports = setupStatics;
