const Story = require('../../models/story');
const StoryStats = require('../../models/storyStats');
const StoryRankings = require('../../models/storyRankings');
const Chapter = require('../../models/chapter');
const moment = require('moment');

/**
 * Service xử lý logic nghiệp vụ cho xếp hạng truyện
 */
class RankingService {
  /**
   * Tính toán điểm xếp hạng cho một truyện sử dụng Công thức Bayesian
   * @param {Object} story - Thông tin truyện
   * @param {Object} stats - Thống kê của truyện
   * @param {Object} options - Các tùy chọn tính toán
   * @returns {number} - Điểm xếp hạng
   */
  calculateBayesianScore(story, stats, options = {}) {
    // Lấy các thông số từ stats hoặc giá trị mặc định
    const views = stats?.views || story.views || 0;
    const ratings_count = stats?.ratings_count || 0;
    const ratings_sum = stats?.ratings_sum || 0;
    const comments_count = stats?.comments_count || 0;
    const bookmarks_count = stats?.bookmarks_count || 0;

    // Tính điểm đánh giá trung bình
    const avgRating = ratings_count > 0 ? ratings_sum / ratings_count : 0;

    // Số lượng đánh giá tối thiểu để có độ tin cậy cao
    const minRatings = options.minRatings || 10;

    // Điểm đánh giá trung bình của tất cả truyện
    const avgRatingAllStories = options.avgRatingAllStories || 3.5;

    // Tính toán điểm Bayesian
    const bayesianRating = ((ratings_count / (ratings_count + minRatings)) * avgRating) +
                          ((minRatings / (ratings_count + minRatings)) * avgRatingAllStories);

    // Tính số ngày kể từ lần cập nhật cuối
    const daysSinceLastUpdate = story.updatedAt ?
      Math.max(0, moment().diff(moment(story.updatedAt), 'days')) : 0;

    // Điểm cơ bản dựa trên các thông số
    const baseScore = (views * 0.4) + (avgRating * 10 * 0.3) + (bookmarks_count * 0.2) + (comments_count * 0.1);

    // Điều chỉnh theo thời gian (giảm 5% mỗi ngày không cập nhật)
    const timeAdjustedScore = baseScore * Math.pow(0.95, daysSinceLastUpdate);

    // Điểm cuối cùng
    const finalScore = (timeAdjustedScore * 0.7) + (bayesianRating * 10 * 0.3);

    return finalScore;
  }

  /**
   * Cập nhật xếp hạng theo ngày
   * @returns {Promise<number>} - Số lượng truyện đã cập nhật
   */
  async updateDailyRankings() {
    try {
      console.log('[Ranking Service] Updating daily rankings...');

      // Lấy ngày hiện tại
      const today = moment().startOf('day').toDate();
      const yesterday = moment().subtract(1, 'days').startOf('day').toDate();

      // Lấy thống kê của ngày hôm qua
      const stats = await StoryStats.aggregateByDate(yesterday);

      // Lấy tất cả truyện có trạng thái active
      const stories = await Story.find({ status: true });

      // Tính toán điểm trung bình của tất cả truyện từ StoryStats
      let totalRating = 0;
      let totalCount = 0;

      try {
        // Lấy tổng đánh giá từ StoryStats
        const allStats = await StoryStats.aggregateAllTime();

        allStats.forEach(stat => {
          if (stat.ratings_count > 0) {
            totalRating += stat.ratings_sum;
            totalCount += stat.ratings_count;
          }
        });
      } catch (error) {
        console.error('[Ranking Service] Error calculating average rating from StoryStats:', error);

        // Fallback: Sử dụng dữ liệu từ Story nếu có lỗi
        stories.forEach(story => {
          if (story.count_star > 0) {
            totalRating += story.stars * story.count_star;
            totalCount += story.count_star;
          }
        });
      }

      const avgRatingAllStories = totalCount > 0 ? totalRating / totalCount : 3.5;

      // Tính toán điểm xếp hạng cho mỗi truyện
      const scores = [];

      for (const story of stories) {
        // Tìm thống kê của truyện
        const storyStat = stats.find(s => s._id.toString() === story._id.toString());

        // Tính điểm xếp hạng
        const score = this.calculateBayesianScore(story, storyStat, {
          avgRatingAllStories,
          minRatings: 10
        });

        scores.push({
          story_id: story._id,
          score
        });
      }

      // Sắp xếp theo điểm giảm dần
      scores.sort((a, b) => b.score - a.score);

      // Cập nhật xếp hạng
      const bulkOps = [];

      scores.forEach((item, index) => {
        const rank = index + 1;

        // Chuẩn bị dữ liệu cập nhật
        const updateData = {
          story_id: item.story_id,
          date: today,
          daily_score: item.score,
          daily_rank: rank,
          day: today.getDate(),
          month: today.getMonth(),
          year: today.getFullYear(),
          week: moment(today).isoWeek()
        };

        bulkOps.push({
          updateOne: {
            filter: { story_id: item.story_id, date: today },
            update: { $set: updateData },
            upsert: true
          }
        });

        // Cập nhật trạng thái hot_day cho truyện
        if (rank <= 10) {
          Story.updateOne(
            { _id: item.story_id },
            { $set: { hot_day: true } }
          ).exec();
        } else {
          Story.updateOne(
            { _id: item.story_id },
            { $set: { hot_day: false } }
          ).exec();
        }
      });

      // Thực hiện cập nhật hàng loạt
      if (bulkOps.length > 0) {
        await StoryRankings.bulkWrite(bulkOps);
      }

      console.log(`[Ranking Service] Updated daily rankings for ${scores.length} stories`);
      return scores.length;
    } catch (error) {
      console.error('[Ranking Service] Error updating daily rankings:', error);
      throw error;
    }
  }

  /**
   * Cập nhật xếp hạng theo tuần
   * @returns {Promise<number>} - Số lượng truyện đã cập nhật
   */
  async updateWeeklyRankings() {
    try {
      console.log('[Ranking Service] Updating weekly rankings...');

      // Lấy ngày hiện tại
      const today = moment().startOf('day').toDate();

      // Lấy tuần hiện tại
      const currentYear = today.getFullYear();
      const currentWeek = moment(today).isoWeek();

      // Lấy thống kê của tuần hiện tại
      const stats = await StoryStats.aggregateByWeek(currentYear, currentWeek);

      // Lấy tất cả truyện có trạng thái active
      const stories = await Story.find({ status: true });

      // Tính toán điểm trung bình của tất cả truyện từ StoryStats
      let totalRating = 0;
      let totalCount = 0;

      try {
        // Lấy tổng đánh giá từ StoryStats
        const allStats = await StoryStats.aggregateAllTime();

        allStats.forEach(stat => {
          if (stat.ratings_count > 0) {
            totalRating += stat.ratings_sum;
            totalCount += stat.ratings_count;
          }
        });
      } catch (error) {
        console.error('[Ranking Service] Error calculating average rating from StoryStats:', error);

        // Fallback: Sử dụng dữ liệu từ Story nếu có lỗi
        stories.forEach(story => {
          if (story.count_star > 0) {
            totalRating += story.stars * story.count_star;
            totalCount += story.count_star;
          }
        });
      }

      const avgRatingAllStories = totalCount > 0 ? totalRating / totalCount : 3.5;

      // Tính toán điểm xếp hạng cho mỗi truyện
      const scores = [];

      for (const story of stories) {
        // Tìm thống kê của truyện
        const storyStat = stats.find(s => s._id.toString() === story._id.toString());

        // Tính điểm xếp hạng
        const score = this.calculateBayesianScore(story, storyStat, {
          avgRatingAllStories,
          minRatings: 10
        });

        scores.push({
          story_id: story._id,
          score
        });
      }

      // Sắp xếp theo điểm giảm dần
      scores.sort((a, b) => b.score - a.score);

      // Cập nhật xếp hạng
      const bulkOps = [];

      scores.forEach((item, index) => {
        const rank = index + 1;

        bulkOps.push({
          updateOne: {
            filter: { story_id: item.story_id, date: today },
            update: {
              $set: {
                weekly_score: item.score,
                weekly_rank: rank
              }
            },
            upsert: true
          }
        });

        // Cập nhật trạng thái hot_week cho truyện
        if (rank <= 10) {
          Story.updateOne(
            { _id: item.story_id },
            { $set: { hot_week: true } }
          ).exec();
        } else {
          Story.updateOne(
            { _id: item.story_id },
            { $set: { hot_week: false } }
          ).exec();
        }
      });

      // Thực hiện cập nhật hàng loạt
      if (bulkOps.length > 0) {
        await StoryRankings.bulkWrite(bulkOps);
      }

      console.log(`[Ranking Service] Updated weekly rankings for ${scores.length} stories`);
      return scores.length;
    } catch (error) {
      console.error('[Ranking Service] Error updating weekly rankings:', error);
      throw error;
    }
  }

  /**
   * Cập nhật xếp hạng theo tháng
   * @returns {Promise<number>} - Số lượng truyện đã cập nhật
   */
  async updateMonthlyRankings() {
    try {
      console.log('[Ranking Service] Updating monthly rankings...');

      // Lấy ngày hiện tại
      const today = moment().startOf('day').toDate();

      // Lấy tháng hiện tại
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      // Lấy thống kê của tháng hiện tại
      const stats = await StoryStats.aggregateByMonth(currentYear, currentMonth);

      // Lấy tất cả truyện có trạng thái active
      const stories = await Story.find({ status: true });

      // Tính toán điểm trung bình của tất cả truyện từ StoryStats
      let totalRating = 0;
      let totalCount = 0;

      try {
        // Lấy tổng đánh giá từ StoryStats
        const allStats = await StoryStats.aggregateAllTime();

        allStats.forEach(stat => {
          if (stat.ratings_count > 0) {
            totalRating += stat.ratings_sum;
            totalCount += stat.ratings_count;
          }
        });
      } catch (error) {
        console.error('[Ranking Service] Error calculating average rating from StoryStats:', error);

        // Fallback: Sử dụng dữ liệu từ Story nếu có lỗi
        stories.forEach(story => {
          if (story.count_star > 0) {
            totalRating += story.stars * story.count_star;
            totalCount += story.count_star;
          }
        });
      }

      const avgRatingAllStories = totalCount > 0 ? totalRating / totalCount : 3.5;

      // Tính toán điểm xếp hạng cho mỗi truyện
      const scores = [];

      for (const story of stories) {
        // Tìm thống kê của truyện
        const storyStat = stats.find(s => s._id.toString() === story._id.toString());

        // Tính điểm xếp hạng
        const score = this.calculateBayesianScore(story, storyStat, {
          avgRatingAllStories,
          minRatings: 10
        });

        scores.push({
          story_id: story._id,
          score
        });
      }

      // Sắp xếp theo điểm giảm dần
      scores.sort((a, b) => b.score - a.score);

      // Cập nhật xếp hạng
      const bulkOps = [];

      scores.forEach((item, index) => {
        const rank = index + 1;

        bulkOps.push({
          updateOne: {
            filter: { story_id: item.story_id, date: today },
            update: {
              $set: {
                monthly_score: item.score,
                monthly_rank: rank
              }
            },
            upsert: true
          }
        });

        // Cập nhật trạng thái hot_month cho truyện
        if (rank <= 10) {
          Story.updateOne(
            { _id: item.story_id },
            { $set: { hot_month: true } }
          ).exec();
        } else {
          Story.updateOne(
            { _id: item.story_id },
            { $set: { hot_month: false } }
          ).exec();
        }
      });

      // Thực hiện cập nhật hàng loạt
      if (bulkOps.length > 0) {
        await StoryRankings.bulkWrite(bulkOps);
      }

      console.log(`[Ranking Service] Updated monthly rankings for ${scores.length} stories`);
      return scores.length;
    } catch (error) {
      console.error('[Ranking Service] Error updating monthly rankings:', error);
      throw error;
    }
  }

  /**
   * Cập nhật xếp hạng toàn thời gian
   * @returns {Promise<number>} - Số lượng truyện đã cập nhật
   */
  async updateAllTimeRankings() {
    try {
      console.log('[Ranking Service] Updating all-time rankings...');

      // Lấy ngày hiện tại
      const today = moment().startOf('day').toDate();

      // Lấy thống kê toàn thời gian
      const stats = await StoryStats.aggregateAllTime();

      // Lấy tất cả truyện có trạng thái active
      const stories = await Story.find({ status: true });

      // Tính toán điểm trung bình của tất cả truyện từ StoryStats
      let totalRating = 0;
      let totalCount = 0;

      try {
        // Lấy tổng đánh giá từ StoryStats
        const allStats = await StoryStats.aggregateAllTime();

        allStats.forEach(stat => {
          if (stat.ratings_count > 0) {
            totalRating += stat.ratings_sum;
            totalCount += stat.ratings_count;
          }
        });
      } catch (error) {
        console.error('[Ranking Service] Error calculating average rating from StoryStats:', error);

        // Fallback: Sử dụng dữ liệu từ Story nếu có lỗi
        stories.forEach(story => {
          if (story.count_star > 0) {
            totalRating += story.stars * story.count_star;
            totalCount += story.count_star;
          }
        });
      }

      const avgRatingAllStories = totalCount > 0 ? totalRating / totalCount : 3.5;

      // Tính toán điểm xếp hạng cho mỗi truyện
      const scores = [];

      for (const story of stories) {
        // Tìm thống kê của truyện
        const storyStat = stats.find(s => s._id.toString() === story._id.toString());

        // Tính điểm xếp hạng
        const score = this.calculateBayesianScore(story, storyStat, {
          avgRatingAllStories,
          minRatings: 10
        });

        scores.push({
          story_id: story._id,
          score
        });
      }

      // Sắp xếp theo điểm giảm dần
      scores.sort((a, b) => b.score - a.score);

      // Cập nhật xếp hạng
      const bulkOps = [];

      scores.forEach((item, index) => {
        const rank = index + 1;

        bulkOps.push({
          updateOne: {
            filter: { story_id: item.story_id, date: today },
            update: {
              $set: {
                all_time_score: item.score,
                all_time_rank: rank
              }
            },
            upsert: true
          }
        });

        // Cập nhật trạng thái hot_all_time cho truyện
        if (rank <= 10) {
          Story.updateOne(
            { _id: item.story_id },
            { $set: { hot_all_time: true } }
          ).exec();
        } else {
          Story.updateOne(
            { _id: item.story_id },
            { $set: { hot_all_time: false } }
          ).exec();
        }
      });

      // Thực hiện cập nhật hàng loạt
      if (bulkOps.length > 0) {
        await StoryRankings.bulkWrite(bulkOps);
      }

      console.log(`[Ranking Service] Updated all-time rankings for ${scores.length} stories`);
      return scores.length;
    } catch (error) {
      console.error('[Ranking Service] Error updating all-time rankings:', error);
      throw error;
    }
  }
}

module.exports = new RankingService();
