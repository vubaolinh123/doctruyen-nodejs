/**
 * Revenue Analytics Controller for Author Panel
 * Handles revenue analytics and reporting for authors
 */

const revenueService = require('../../services/revenue/revenueService');
const Author = require('../../models/author');

/**
 * Get revenue overview for authenticated author
 * GET /api/author-panel/revenue/overview
 */
exports.getRevenueOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Extract query parameters
    const { 
      startDate, 
      endDate, 
      period = '30d' // 7d, 30d, 90d, 1y, all
    } = req.query;

    // Find author record
    let author;
    if (userRole === 'admin') {
      // Admin can access all revenue data (for testing/debugging)
      const { authorId } = req.query;
      if (!authorId) {
        return res.status(400).json({
          success: false,
          message: 'Admin must specify authorId parameter'
        });
      }
      author = await Author.findById(authorId);
    } else {
      // Regular author access
      author = await Author.findOne({ 
        userId: userId, 
        authorType: 'system',
        approvalStatus: 'approved'
      });
    }

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại hoặc chưa được duyệt'
      });
    }

    // Calculate date range based on period
    let dateRange = {};
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      dateRange = calculateDateRange(period);
    }

    // Get revenue overview
    const overview = await revenueService.getRevenueOverview(author._id, dateRange);

    // Add period info to response
    overview.period = {
      type: period,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    };

    res.json({
      success: true,
      message: 'Lấy tổng quan doanh thu thành công',
      data: overview
    });

  } catch (error) {
    console.error('Error getting revenue overview:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy tổng quan doanh thu',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get revenue details for a specific story
 * GET /api/author-panel/revenue/stories/:storyId
 */
exports.getStoryRevenue = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { storyId } = req.params;
    
    // Extract query parameters
    const { 
      startDate, 
      endDate, 
      period = '30d'
    } = req.query;

    // Find author record
    let author;
    if (userRole === 'admin') {
      // Admin can access all story revenue data
      const { authorId } = req.query;
      if (!authorId) {
        return res.status(400).json({
          success: false,
          message: 'Admin must specify authorId parameter'
        });
      }
      author = await Author.findById(authorId);
    } else {
      // Regular author access
      author = await Author.findOne({ 
        userId: userId, 
        authorType: 'system',
        approvalStatus: 'approved'
      });
    }

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại hoặc chưa được duyệt'
      });
    }

    // Calculate date range
    let dateRange = {};
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      dateRange = calculateDateRange(period);
    }

    // Get story revenue details
    const storyRevenue = await revenueService.getStoryRevenue(author._id, storyId, dateRange);

    // Add period info to response
    storyRevenue.period = {
      type: period,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    };

    res.json({
      success: true,
      message: 'Lấy doanh thu truyện thành công',
      data: storyRevenue
    });

  } catch (error) {
    console.error('Error getting story revenue:', error);
    
    if (error.message === 'Story not found or access denied') {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại hoặc bạn không có quyền truy cập'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy doanh thu truyện',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get transaction history for authenticated author
 * GET /api/author-panel/revenue/transactions
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Extract query parameters
    const { 
      page = 1, 
      limit = 20, 
      startDate, 
      endDate, 
      storyId, 
      transactionType, // 'story' or 'chapter'
      period = '30d'
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page

    // Find author record
    let author;
    if (userRole === 'admin') {
      // Admin can access all transaction history
      const { authorId } = req.query;
      if (!authorId) {
        return res.status(400).json({
          success: false,
          message: 'Admin must specify authorId parameter'
        });
      }
      author = await Author.findById(authorId);
    } else {
      // Regular author access
      author = await Author.findOne({ 
        userId: userId, 
        authorType: 'system',
        approvalStatus: 'approved'
      });
    }

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại hoặc chưa được duyệt'
      });
    }

    // Calculate date range
    let dateRange = {};
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      dateRange = calculateDateRange(period);
    }

    // Prepare options for service
    const options = {
      page: pageNum,
      limit: limitNum,
      ...dateRange,
      storyId,
      transactionType
    };

    // Get transaction history
    const transactionHistory = await revenueService.getTransactionHistory(author._id, options);

    // Add period info to response
    transactionHistory.period = {
      type: period,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    };

    res.json({
      success: true,
      message: 'Lấy lịch sử giao dịch thành công',
      data: transactionHistory
    });

  } catch (error) {
    console.error('Error getting transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch sử giao dịch',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Calculate date range based on period
 * @private
 */
function calculateDateRange(period) {
  const now = new Date();
  let startDate;

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      startDate = new Date('2020-01-01'); // Arbitrary early date
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: now.toISOString()
  };
}
