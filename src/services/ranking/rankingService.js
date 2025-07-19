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
    const chapter_count = story.chapter_count || 0;

    // Tính điểm đánh giá trung bình
    const avgRating = ratings_count > 0 ? ratings_sum / ratings_count : 0;

    // Số lượng đánh giá tối thiểu để có độ tin cậy cao (giảm xuống để dễ dàng hơn)
    const minRatings = options.minRatings || 3;

    // Điểm đánh giá trung bình của tất cả truyện
    const avgRatingAllStories = options.avgRatingAllStories || 3.5;

    // Tính toán điểm Bayesian (nếu không có đánh giá, sử dụng giá trị mặc định)
    const bayesianRating = ratings_count > 0
      ? ((ratings_count / (ratings_count + minRatings)) * avgRating) + ((minRatings / (ratings_count + minRatings)) * avgRatingAllStories)
      : avgRatingAllStories / 2; // Giá trị mặc định thấp hơn nếu không có đánh giá

    // Tính số ngày kể từ lần cập nhật cuối
    const daysSinceLastUpdate = story.updatedAt ?
      Math.max(0, moment().diff(moment(story.updatedAt), 'days')) : 0;

    // Điểm cơ bản dựa trên các thông số (tăng trọng số cho views khi không có đánh giá)
    let baseScore;
    if (ratings_count > 0) {
      // Nếu có đánh giá, sử dụng công thức cân bằng
      baseScore = (views * 0.4) + (avgRating * 10 * 0.3) + (bookmarks_count * 0.2) + (comments_count * 0.1);
    } else {
      // Nếu không có đánh giá, tăng trọng số cho views và số chương
      baseScore = (views * 0.6) + (bookmarks_count * 0.2) + (comments_count * 0.1) + (chapter_count * 0.1);
    }

    // Điều chỉnh theo thời gian (giảm 3% mỗi ngày không cập nhật thay vì 5%)
    const timeAdjustedScore = baseScore * Math.pow(0.97, daysSinceLastUpdate);

    // Điểm cuối cùng (tăng trọng số cho timeAdjustedScore khi không có đánh giá)
    const finalScore = ratings_count > 0
      ? (timeAdjustedScore * 0.7) + (bayesianRating * 10 * 0.3)
      : (timeAdjustedScore * 0.9) + (bayesianRating * 10 * 0.1);

    // Đảm bảo điểm không âm và có giá trị tối thiểu
    return Math.max(1, finalScore);
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

      // Lấy tất cả truyện đã được xuất bản và phê duyệt
      const stories = await Story.find({
        status: 'published',
        approval_status: 'approved'
      });

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

      // Lấy tất cả truyện đã được xuất bản và phê duyệt
      const stories = await Story.find({
        status: 'published',
        approval_status: 'approved'
      });

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

      // Lấy tất cả truyện đã được xuất bản và phê duyệt
      const stories = await Story.find({
        status: 'published',
        approval_status: 'approved'
      });

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
   * Khởi tạo dữ liệu ranking khi server startup
   * Kiểm tra và tạo dữ liệu ranking nếu chưa có hoặc dữ liệu cũ
   * @returns {Promise<Object>} - Kết quả khởi tạo
   */
  async initializeRankingsOnStartup() {
    try {
      console.log('[Ranking Service] Initializing rankings on server startup...');

      const today = moment().startOf('day').toDate();

      // Kiểm tra xem có dữ liệu ranking cho ngày hôm nay không
      const existingRankings = await StoryRankings.countDocuments({
        date: {
          $gte: moment(today).startOf('day').toDate(),
          $lte: moment(today).endOf('day').toDate()
        }
      });

      console.log(`[Ranking Service] Found ${existingRankings} existing rankings for today`);

      // Nếu chưa có dữ liệu ranking cho ngày hôm nay, tạo mới
      if (existingRankings === 0) {
        console.log('[Ranking Service] No rankings found for today. Creating initial rankings...');

        const dailyCount = await this.updateDailyRankings();
        const weeklyCount = await this.updateWeeklyRankings();
        const monthlyCount = await this.updateMonthlyRankings();
        const allTimeCount = await this.updateAllTimeRankings();

        console.log('[Ranking Service] Initial rankings created successfully');
        console.log(`[Ranking Service] - Daily: ${dailyCount} stories`);
        console.log(`[Ranking Service] - Weekly: ${weeklyCount} stories`);
        console.log(`[Ranking Service] - Monthly: ${monthlyCount} stories`);
        console.log(`[Ranking Service] - All-time: ${allTimeCount} stories`);

        return {
          success: true,
          created: true,
          counts: {
            daily: dailyCount,
            weekly: weeklyCount,
            monthly: monthlyCount,
            allTime: allTimeCount
          }
        };
      } else {
        console.log('[Ranking Service] Rankings already exist for today. Skipping initialization.');
        return {
          success: true,
          created: false,
          message: 'Rankings already exist for today'
        };
      }
    } catch (error) {
      console.error('[Ranking Service] Error initializing rankings on startup:', error);
      return {
        success: false,
        error: error.message
      };
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

      // Lấy tất cả truyện đã được xuất bản và phê duyệt
      const stories = await Story.find({
        status: 'published',
        approval_status: 'approved'
      });

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
