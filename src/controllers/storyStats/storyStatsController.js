const storyStatsService = require('../../services/storyStats/storyStatsService');

/**
 * Controller xử lý các chức năng của thống kê truyện
 */
class StoryStatsController {
  /**
   * Lấy tổng lượt xem của một truyện
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getTotalViews(req, res) {
    try {
      const { storyId } = req.params;
      
      if (!storyId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Story ID is required' 
        });
      }
      
      const totalViews = await storyStatsService.getTotalViews(storyId);
      
      res.json({
        success: true,
        totalViews
      });
    } catch (err) {
      console.error('Error in getTotalViews:', err);
      res.status(500).json({ 
        success: false, 
        message: err.message || 'Internal server error' 
      });
    }
  }

  /**
   * Lấy lượt xem của một truyện trong một khoảng thời gian
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getViewsByTimeRange(req, res) {
    try {
      const { storyId } = req.params;
      const { timeRange = 'all' } = req.query;
      
      if (!storyId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Story ID is required' 
        });
      }
      
      const views = await storyStatsService.getViewsByTimeRange(storyId, timeRange);
      
      res.json({
        success: true,
        views,
        timeRange
      });
    } catch (err) {
      console.error('Error in getViewsByTimeRange:', err);
      res.status(500).json({ 
        success: false, 
        message: err.message || 'Internal server error' 
      });
    }
  }

  /**
   * Lấy thống kê đánh giá của một truyện
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getRatingStats(req, res) {
    try {
      const { storyId } = req.params;
      
      if (!storyId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Story ID is required' 
        });
      }
      
      const stats = await storyStatsService.getRatingStats(storyId);
      
      res.json({
        success: true,
        stats
      });
    } catch (err) {
      console.error('Error in getRatingStats:', err);
      res.status(500).json({ 
        success: false, 
        message: err.message || 'Internal server error' 
      });
    }
  }
}

module.exports = new StoryStatsController();
