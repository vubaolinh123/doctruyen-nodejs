/**
 * Định nghĩa các static methods cho StoryRankings model
 * @param {Object} schema - Schema của StoryRankings model
 */
const setupStatics = (schema) => {
  /**
   * Lấy xếp hạng của một truyện trong một ngày cụ thể
   * @param {string} storyId - ID của truyện
   * @param {Date} date - Ngày cần lấy xếp hạng
   * @returns {Promise<Object>} - Xếp hạng của truyện
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
   * Lấy xếp hạng theo ngày
   * @param {Date} date - Ngày cần lấy xếp hạng
   * @param {number} limit - Số lượng truyện cần lấy
   * @param {number} skip - Số lượng truyện cần bỏ qua
   * @returns {Promise<Array>} - Danh sách xếp hạng
   */
  schema.statics.findDailyRankings = function(date, limit = 10, skip = 0) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.find({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
      // Đã loại bỏ điều kiện daily_rank > 0 để hiển thị tất cả truyện
    })
      .sort({ daily_rank: 1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'story_id',
        select: 'name slug image desc categories author_id views is_full is_hot is_new',
        populate: [
          { path: 'categories', select: 'name slug' },
          { path: 'author_id', select: 'name slug' }
        ]
      });
  };

  /**
   * Lấy xếp hạng theo tuần
   * @param {Date} date - Ngày trong tuần cần lấy xếp hạng
   * @param {number} limit - Số lượng truyện cần lấy
   * @param {number} skip - Số lượng truyện cần bỏ qua
   * @returns {Promise<Array>} - Danh sách xếp hạng
   */
  schema.statics.findWeeklyRankings = function(date, limit = 10, skip = 0) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.find({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
      // Đã loại bỏ điều kiện weekly_rank > 0 để hiển thị tất cả truyện
    })
      .sort({ weekly_rank: 1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'story_id',
        select: 'name slug image desc categories author_id views is_full is_hot is_new',
        populate: [
          { path: 'categories', select: 'name slug' },
          { path: 'author_id', select: 'name slug' }
        ]
      });
  };

  /**
   * Lấy xếp hạng theo tháng
   * @param {Date} date - Ngày trong tháng cần lấy xếp hạng
   * @param {number} limit - Số lượng truyện cần lấy
   * @param {number} skip - Số lượng truyện cần bỏ qua
   * @returns {Promise<Array>} - Danh sách xếp hạng
   */
  schema.statics.findMonthlyRankings = function(date, limit = 10, skip = 0) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.find({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
      // Đã loại bỏ điều kiện monthly_rank > 0 để hiển thị tất cả truyện
    })
      .sort({ monthly_rank: 1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'story_id',
        select: 'name slug image desc categories author_id views is_full is_hot is_new',
        populate: [
          { path: 'categories', select: 'name slug' },
          { path: 'author_id', select: 'name slug' }
        ]
      });
  };

  /**
   * Lấy xếp hạng toàn thời gian
   * @param {Date} date - Ngày cần lấy xếp hạng
   * @param {number} limit - Số lượng truyện cần lấy
   * @param {number} skip - Số lượng truyện cần bỏ qua
   * @returns {Promise<Array>} - Danh sách xếp hạng
   */
  schema.statics.findAllTimeRankings = function(date, limit = 10, skip = 0) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.find({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
      // Đã loại bỏ điều kiện all_time_rank > 0 để hiển thị tất cả truyện
    })
      .sort({ all_time_rank: 1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'story_id',
        select: 'name slug image desc categories author_id views is_full is_hot is_new',
        populate: [
          { path: 'categories', select: 'name slug' },
          { path: 'author_id', select: 'name slug' }
        ]
      });
  };

  /**
   * Đếm tổng số truyện có xếp hạng theo ngày
   * @param {Date} date - Ngày cần đếm
   * @returns {Promise<number>} - Tổng số truyện
   */
  schema.statics.countDailyRankings = function(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.countDocuments({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
      // Đã loại bỏ điều kiện daily_rank > 0 để đếm tất cả truyện
    });
  };
};

module.exports = setupStatics;
