const Transaction = require('../../models/transaction');
const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const Author = require('../../models/author');
const PurchasedStory = require('../../models/purchasedStory');
const UserPurchases = require('../../models/userPurchases');
const mongoose = require('mongoose');

/**
 * Get revenue overview for author
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRevenueOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '30d' } = req.query;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;

    if (!isAdmin) {
      // Find author record for regular users
      author = await Author.findOne({
        userId: userId,
        authorType: 'system',
        approvalStatus: 'approved'
      });

      if (!author) {
        return res.status(404).json({
          success: false,
          message: 'Tác giả không tồn tại'
        });
      }
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeRange) {
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
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get revenue data
    const [
      totalEarnings,
      periodEarnings,
      totalSales,
      periodSales,
      topEarningStories,
      revenueByDay
    ] = await Promise.all([
      // Total lifetime earnings
      Transaction.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'reference_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            type: { $in: ['story_purchase', 'chapter_purchase'] },
            status: 'completed',
            ...(isAdmin ? {} : { 'story.author_id': author._id })
          }
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$amount' }
          }
        }
      ]).then(result => result[0]?.totalEarnings || 0),

      // Period earnings
      Transaction.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'reference_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            type: { $in: ['story_purchase', 'chapter_purchase'] },
            status: 'completed',
            createdAt: { $gte: startDate },
            ...(isAdmin ? {} : { 'story.author_id': author._id })
          }
        },
        {
          $group: {
            _id: null,
            periodEarnings: { $sum: '$amount' }
          }
        }
      ]).then(result => result[0]?.periodEarnings || 0),

      // Total sales count
      Transaction.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'reference_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            type: { $in: ['story_purchase', 'chapter_purchase'] },
            status: 'completed',
            ...(isAdmin ? {} : { 'story.author_id': author._id })
          }
        },
        {
          $count: 'total'
        }
      ]).then(result => result[0]?.total || 0),

      // Period sales count
      Transaction.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'reference_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            type: { $in: ['story_purchase', 'chapter_purchase'] },
            status: 'completed',
            createdAt: { $gte: startDate },
            ...(isAdmin ? {} : { 'story.author_id': author._id })
          }
        },
        {
          $count: 'total'
        }
      ]).then(result => result[0]?.total || 0),

      // Top earning stories
      Transaction.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'reference_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            type: { $in: ['story_purchase', 'chapter_purchase'] },
            status: 'completed',
            ...(isAdmin ? {} : { 'story.author_id': author._id })
          }
        },
        {
          $match: {
            'story.0': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$reference_id',
            totalEarnings: { $sum: '$amount' },
            salesCount: { $sum: 1 },
            story: { $first: '$story' }
          }
        },
        {
          $sort: { totalEarnings: -1 }
        },
        {
          $limit: 5
        },
        {
          $project: {
            storyId: '$_id',
            totalEarnings: 1,
            salesCount: 1,
            storyName: { $arrayElemAt: ['$story.name', 0] },
            storySlug: { $arrayElemAt: ['$story.slug', 0] }
          }
        }
      ]),

      // Revenue by day for chart
      Transaction.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'reference_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            type: { $in: ['story_purchase', 'chapter_purchase'] },
            status: 'completed',
            createdAt: { $gte: startDate },
            ...(isAdmin ? {} : { 'story.author_id': author._id })
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            dailyEarnings: { $sum: '$amount' },
            salesCount: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
    ]);

    // Calculate growth rate
    const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    const previousPeriodEarnings = await Transaction.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          type: 'income',
          reference_type: { $in: ['story', 'chapter'] },
          createdAt: { 
            $gte: previousPeriodStart,
            $lt: startDate
          }
        }
      },
      {
        $group: {
          _id: null,
          earnings: { $sum: '$amount' }
        }
      }
    ]).then(result => result[0]?.earnings || 0);

    const growthRate = previousPeriodEarnings > 0 
      ? ((periodEarnings - previousPeriodEarnings) / previousPeriodEarnings * 100).toFixed(1)
      : periodEarnings > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalEarnings,
          periodEarnings,
          totalSales,
          periodSales,
          growthRate: parseFloat(growthRate),
          averagePerSale: totalSales > 0 ? (totalEarnings / totalSales).toFixed(2) : 0
        },
        topEarningStories,
        revenueChart: revenueByDay,
        timeRange
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Revenue overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy tổng quan doanh thu',
      error: error.message
    });
  }
};

/**
 * Get detailed earnings by story
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getStoryEarnings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      timeRange = '30d',
      sortBy = 'earnings',
      sortOrder = 'desc'
    } = req.query;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;

    if (!isAdmin) {
      // Find author record for regular users
      author = await Author.findOne({
        userId: userId,
        authorType: 'system',
        approvalStatus: 'approved'
      });

      if (!author) {
        return res.status(404).json({
          success: false,
          message: 'Tác giả không tồn tại'
        });
      }
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get story earnings
    const storyEarnings = await Transaction.aggregate([
      {
        $lookup: {
          from: 'stories',
          localField: 'reference_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      {
        $match: {
          type: { $in: ['story_purchase', 'chapter_purchase'] },
          status: 'completed',
          createdAt: { $gte: startDate },
          'story.0': { $exists: true },
          ...(isAdmin ? {} : { 'story.author_id': author._id })
        }
      },
      {
        $group: {
          _id: '$reference_id',
          totalEarnings: { $sum: '$amount' },
          salesCount: { $sum: 1 },
          lastSale: { $max: '$createdAt' },
          story: { $first: '$story' }
        }
      },
      {
        $project: {
          storyId: '$_id',
          totalEarnings: 1,
          salesCount: 1,
          lastSale: 1,
          averagePerSale: { $divide: ['$totalEarnings', '$salesCount'] },
          storyName: { $arrayElemAt: ['$story.name', 0] },
          storySlug: { $arrayElemAt: ['$story.slug', 0] },
          storyPrice: { $arrayElemAt: ['$story.price', 0] },
          storyViews: { $arrayElemAt: ['$story.view', 0] }
        }
      },
      {
        $sort: { 
          [sortBy === 'earnings' ? 'totalEarnings' : sortBy === 'sales' ? 'salesCount' : 'lastSale']: 
          sortOrder === 'desc' ? -1 : 1 
        }
      },
      {
        $skip: (parseInt(page) - 1) * parseInt(limit)
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    // Get total count for pagination
    const totalCount = await Transaction.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          type: 'income',
          reference_type: { $in: ['story', 'chapter'] },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$reference_id'
        }
      },
      {
        $count: 'total'
      }
    ]).then(result => result[0]?.total || 0);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        stories: storyEarnings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        timeRange
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Story earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy doanh thu theo truyện',
      error: error.message
    });
  }
};

/**
 * Get transaction history
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      type = 'all',
      timeRange = '30d'
    } = req.query;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;

    if (!isAdmin) {
      // Find author record for regular users
      author = await Author.findOne({
        userId: userId,
        authorType: 'system',
        approvalStatus: 'approved'
      });

      if (!author) {
        return res.status(404).json({
          success: false,
          message: 'Tác giả không tồn tại'
        });
      }
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build base query
    let baseQuery = {
      createdAt: { $gte: startDate },
      type: { $in: ['story_purchase', 'chapter_purchase'] },
      status: 'completed'
    };

    if (type !== 'all') {
      baseQuery.type = type;
    }

    // Get transactions with pagination using aggregation for proper filtering
    const transactionsPipeline = [
      {
        $lookup: {
          from: 'stories',
          localField: 'reference_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      {
        $match: {
          ...baseQuery,
          ...(isAdmin ? {} : { 'story.author_id': author._id })
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $addFields: {
          user: { $arrayElemAt: ['$user', 0] },
          story: { $arrayElemAt: ['$story', 0] }
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ];

    const [transactions, totalTransactions] = await Promise.all([
      Transaction.aggregate([
        ...transactionsPipeline,
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ]),
      Transaction.aggregate([
        ...transactionsPipeline,
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0)
    ]);

    const totalPages = Math.ceil(totalTransactions / parseInt(limit));

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalTransactions,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        timeRange
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Transaction history error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch sử giao dịch',
      error: error.message
    });
  }
};

/**
 * Get payout information
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getPayoutInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;

    if (!isAdmin) {
      // Find author record for regular users
      author = await Author.findOne({
        userId: userId,
        authorType: 'system',
        approvalStatus: 'approved'
      });

      if (!author) {
        return res.status(404).json({
          success: false,
          message: 'Tác giả không tồn tại'
        });
      }
    }

    // Get available balance (total income - total payouts)
    const [totalIncome, totalPayouts] = await Promise.all([
      // Total income from story/chapter purchases
      Transaction.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'reference_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            type: { $in: ['story_purchase', 'chapter_purchase'] },
            status: 'completed',
            ...(isAdmin ? {} : { 'story.author_id': author._id })
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).then(result => result[0]?.total || 0),

      // Total payouts (for now, return 0 as we don't have payout records yet)
      Promise.resolve(0)
    ]);

    const availableBalance = totalIncome - totalPayouts;

    // Get recent payout requests (mock data for now)
    const recentPayouts = [];

    res.json({
      success: true,
      data: {
        balance: {
          totalIncome,
          totalPayouts,
          availableBalance,
          minimumPayout: 100000 // 100k coins minimum
        },
        recentPayouts,
        payoutInfo: {
          processingTime: '3-5 ngày làm việc',
          minimumAmount: 100000,
          fees: '5% phí xử lý'
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Payout info error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin rút tiền',
      error: error.message
    });
  }
};

/**
 * Request payout
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.requestPayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, paymentMethod, paymentDetails } = req.body;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    // Validate amount
    if (!amount || amount < 100000) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền rút tối thiểu là 100,000 xu'
      });
    }

    let author = null;

    if (!isAdmin) {
      // Find author record for regular users
      author = await Author.findOne({
        userId: userId,
        authorType: 'system',
        approvalStatus: 'approved'
      });

      if (!author) {
        return res.status(404).json({
          success: false,
          message: 'Tác giả không tồn tại'
        });
      }
    }

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại'
      });
    }

    // Check available balance
    const [totalIncome, totalPayouts] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(userId),
            type: 'income',
            reference_type: { $in: ['story', 'chapter'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).then(result => result[0]?.total || 0),

      Transaction.aggregate([
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(userId),
            type: 'payout'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).then(result => result[0]?.total || 0)
    ]);

    const availableBalance = totalIncome - totalPayouts;

    if (amount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: 'Số dư không đủ để thực hiện giao dịch'
      });
    }

    // Create payout request transaction
    const payoutTransaction = new Transaction({
      user_id: userId,
      type: 'payout',
      amount: -amount, // Negative for payout
      description: `Yêu cầu rút tiền - ${paymentMethod}`,
      reference_type: 'payout',
      status: 'pending',
      metadata: {
        paymentMethod,
        paymentDetails,
        requestedAt: new Date()
      }
    });

    await payoutTransaction.save();

    res.json({
      success: true,
      message: 'Yêu cầu rút tiền đã được gửi thành công',
      data: {
        transactionId: payoutTransaction._id,
        amount,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Request payout error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo yêu cầu rút tiền',
      error: error.message
    });
  }
};
