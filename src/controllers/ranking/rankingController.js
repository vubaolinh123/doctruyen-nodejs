const rankingService = require('../../services/ranking/rankingService');
const StoryRankings = require('../../models/storyRankings');
const moment = require('moment');

/**
 * Controller xử lý các chức năng liên quan đến xếp hạng truyện
 */
class RankingController {
  /**
   * Lấy xếp hạng theo ngày
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getDailyRankings(req, res) {
    try {
      const { limit = 10, page = 1, category } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Lấy ngày hiện tại
      const today = moment().startOf('day').toDate();

      // Lấy danh sách xếp hạng
      const rankings = await StoryRankings.findDailyRankings(today, parseInt(limit), skip);

      // Lọc theo thể loại nếu có
      let result = rankings;
      if (category) {
        result = rankings.filter(r =>
          r.story_id.categories.some(c => c.slug === category)
        );
      }

      // Đếm tổng số truyện
      const total = await StoryRankings.countDailyRankings(today);

      res.json({
        success: true,
        rankings: result,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } catch (err) {
      console.error('Error getting daily rankings:', err);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: err.message
      });
    }
  }

  /**
   * Lấy xếp hạng theo tuần
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getWeeklyRankings(req, res) {
    try {
      const { limit = 10, page = 1, category } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Lấy ngày hiện tại
      const today = moment().startOf('day').toDate();

      // Lấy danh sách xếp hạng
      const rankings = await StoryRankings.findWeeklyRankings(today, parseInt(limit), skip);

      // Lọc theo thể loại nếu có
      let result = rankings;
      if (category) {
        result = rankings.filter(r =>
          r.story_id.categories.some(c => c.slug === category)
        );
      }

      // Đếm tổng số truyện
      const total = await StoryRankings.countDocuments({
        date: {
          $gte: moment(today).startOf('day').toDate(),
          $lte: moment(today).endOf('day').toDate()
        }
        // Removed weekly_rank > 0 condition to count all stories
      });

      res.json({
        success: true,
        rankings: result,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } catch (err) {
      console.error('Error getting weekly rankings:', err);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: err.message
      });
    }
  }

  /**
   * Lấy xếp hạng theo tháng
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getMonthlyRankings(req, res) {
    try {
      const { limit = 10, page = 1, category } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Lấy ngày hiện tại
      const today = moment().startOf('day').toDate();

      // Lấy danh sách xếp hạng
      const rankings = await StoryRankings.findMonthlyRankings(today, parseInt(limit), skip);

      // Lọc theo thể loại nếu có
      let result = rankings;
      if (category) {
        result = rankings.filter(r =>
          r.story_id.categories.some(c => c.slug === category)
        );
      }

      // Đếm tổng số truyện
      const total = await StoryRankings.countDocuments({
        date: {
          $gte: moment(today).startOf('day').toDate(),
          $lte: moment(today).endOf('day').toDate()
        }
        // Removed monthly_rank > 0 condition to count all stories
      });

      res.json({
        success: true,
        rankings: result,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } catch (err) {
      console.error('Error getting monthly rankings:', err);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: err.message
      });
    }
  }

  /**
   * Lấy xếp hạng toàn thời gian
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getAllTimeRankings(req, res) {
    try {
      const { limit = 10, page = 1, category } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Lấy ngày hiện tại
      const today = moment().startOf('day').toDate();

      // Lấy danh sách xếp hạng
      const rankings = await StoryRankings.findAllTimeRankings(today, parseInt(limit), skip);

      // Lọc theo thể loại nếu có
      let result = rankings;
      if (category) {
        result = rankings.filter(r =>
          r.story_id.categories.some(c => c.slug === category)
        );
      }

      // Đếm tổng số truyện
      const total = await StoryRankings.countDocuments({
        date: {
          $gte: moment(today).startOf('day').toDate(),
          $lte: moment(today).endOf('day').toDate()
        }
        // Removed all_time_rank > 0 condition to count all stories
      });

      res.json({
        success: true,
        rankings: result,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } catch (err) {
      console.error('Error getting all-time rankings:', err);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: err.message
      });
    }
  }

  /**
   * Cập nhật xếp hạng theo ngày
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateDailyRankings(req, res) {
    try {
      const count = await rankingService.updateDailyRankings();

      res.json({
        success: true,
        message: `Updated daily rankings for ${count} stories`
      });
    } catch (err) {
      console.error('Error updating daily rankings:', err);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: err.message
      });
    }
  }

  /**
   * Cập nhật xếp hạng theo tuần
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateWeeklyRankings(req, res) {
    try {
      const count = await rankingService.updateWeeklyRankings();

      res.json({
        success: true,
        message: `Updated weekly rankings for ${count} stories`
      });
    } catch (err) {
      console.error('Error updating weekly rankings:', err);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: err.message
      });
    }
  }

  /**
   * Cập nhật xếp hạng theo tháng
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateMonthlyRankings(req, res) {
    try {
      const count = await rankingService.updateMonthlyRankings();

      res.json({
        success: true,
        message: `Updated monthly rankings for ${count} stories`
      });
    } catch (err) {
      console.error('Error updating monthly rankings:', err);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: err.message
      });
    }
  }

  /**
   * Cập nhật xếp hạng toàn thời gian
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateAllTimeRankings(req, res) {
    try {
      const count = await rankingService.updateAllTimeRankings();

      res.json({
        success: true,
        message: `Updated all-time rankings for ${count} stories`
      });
    } catch (err) {
      console.error('Error updating all-time rankings:', err);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: err.message
      });
    }
  }

  /**
   * Cập nhật tất cả xếp hạng
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateAllRankings(req, res) {
    try {
      const dailyCount = await rankingService.updateDailyRankings();
      const weeklyCount = await rankingService.updateWeeklyRankings();
      const monthlyCount = await rankingService.updateMonthlyRankings();
      const allTimeCount = await rankingService.updateAllTimeRankings();

      res.json({
        success: true,
        message: 'Updated all rankings',
        daily: dailyCount,
        weekly: weeklyCount,
        monthly: monthlyCount,
        allTime: allTimeCount
      });
    } catch (err) {
      console.error('Error updating all rankings:', err);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: err.message
      });
    }
  }
}

module.exports = new RankingController();
