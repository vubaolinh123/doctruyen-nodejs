/**
 * Định nghĩa các instance methods cho Story model
 * @param {Object} schema - Schema của Story model
 */
const setupMethods = (schema) => {
  /**
   * Cập nhật số lượng chapter
   * @param {number} delta - Số lượng thay đổi (1 hoặc -1)
   * @returns {Promise<Object>} - Truyện đã cập nhật
   */
  schema.methods.updateChapterCount = async function(delta = 1) {
    this.chapter_count += delta;

    // Đảm bảo chapter_count không âm
    if (this.chapter_count < 0) {
      this.chapter_count = 0;
    }

    return this.save();
  };

  /**
   * Cập nhật lượt xem
   * @param {number} increment - Số lượng tăng (mặc định là 1)
   * @returns {Promise<Object>} - Truyện đã cập nhật
   */
  schema.methods.incrementViews = async function(increment = 1) {
    this.views += increment;
    return this.save();
  };

  /**
   * Cập nhật đánh giá
   * @param {number} rating - Đánh giá mới (1-10)
   * @returns {Promise<Object>} - Truyện đã cập nhật
   */
  schema.methods.addRating = async function(rating) {
    // Đảm bảo rating hợp lệ
    if (rating < 1 || rating > 10) {
      throw new Error('Đánh giá phải từ 1 đến 10');
    }

    // Cập nhật đánh giá trong bảng StoryStats
    try {
      const StoryStats = require('../../models/storyStats');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Lấy thông tin ngày, tháng, năm, tuần
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      const week = require('moment')(today).isoWeek();

      // Tìm hoặc tạo bản ghi thống kê cho ngày hôm nay
      let stats = await StoryStats.findOne({
        story_id: this._id,
        date: today
      });

      if (!stats) {
        // Tạo bản ghi mới nếu chưa có
        stats = new StoryStats({
          story_id: this._id,
          date: today,
          views: 0,
          unique_views: 0,
          ratings_count: 1,
          ratings_sum: rating,
          comments_count: 0,
          bookmarks_count: 0,
          shares_count: 0,
          day,
          month,
          year,
          week
        });
      } else {
        // Cập nhật bản ghi hiện có
        stats.ratings_count += 1;
        stats.ratings_sum += rating;
      }

      await stats.save();
    } catch (error) {
      console.error('Error updating StoryStats for rating:', error);
      throw new Error('Không thể cập nhật đánh giá: ' + error.message);
    }

    return this;
  };
};

module.exports = setupMethods;
