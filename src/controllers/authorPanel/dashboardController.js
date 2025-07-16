const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const Author = require('../../models/author');
const Transaction = require('../../models/transaction');
const Comment = require('../../models/comment');
const UserRating = require('../../models/userRating');
const mongoose = require('mongoose');

/**
 * Get author dashboard overview data
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[AuthorPanel] Getting dashboard overview for user: ${userId}`);

    // Check if user is admin (admins have full access)
    const isAdmin = req.user.role === 'admin';

    let author = null;
    if (isAdmin) {
      // For admin users, create a virtual author or use first available author
      // This allows admins to view the author panel without having an author record
      author = await Author.findOne({ authorType: 'system', approvalStatus: 'approved' });
      if (!author) {
        // If no authors exist, return empty dashboard data
        return res.json({
          success: true,
          data: {
            author: {
              id: null,
              name: 'Admin User',
              slug: 'admin'
            },
            statistics: {
              totalStories: 0,
              totalChapters: 0,
              totalViews: 0,
              totalComments: 0,
              monthlyEarnings: 0,
              earningsGrowth: 0
            },
            recentActivity: {
              stories: [],
              chapters: []
            },
            topPerforming: {
              story: null
            }
          }
        });
      }
    } else {
      // For regular users, find their author record
      author = await Author.findOne({
        userId: userId,
        authorType: 'system',
        approvalStatus: 'approved'
      });

      if (!author) {
        return res.status(404).json({
          success: false,
          message: 'Tác giả không tồn tại hoặc chưa được phê duyệt'
        });
      }
    }

    // Get basic statistics
    const [
      totalStories,
      totalChapters,
      totalViews,
      totalComments,
      recentStories,
      recentChapters,
      monthlyEarnings
    ] = await Promise.all([
      // Total stories count
      Story.countDocuments({ author_id: author._id }),
      
      // Total chapters count
      Chapter.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            'story.author_id': author._id
          }
        },
        {
          $count: 'total'
        }
      ]).then(result => result[0]?.total || 0),

      // Total views (sum of all story views)
      Story.aggregate([
        { $match: { author_id: author._id } },
        { $group: { _id: null, totalViews: { $sum: '$view' } } }
      ]).then(result => result[0]?.totalViews || 0),

      // Total comments on author's stories
      Comment.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            'story.author_id': author._id
          }
        },
        {
          $count: 'total'
        }
      ]).then(result => result[0]?.total || 0),

      // Recent stories (last 5)
      Story.find({ author_id: author._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name slug view createdAt updatedAt status')
        .lean(),

      // Recent chapters (last 5)
      Chapter.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            'story.author_id': author._id
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $limit: 5
        },
        {
          $project: {
            name: 1,
            chapter: 1,
            createdAt: 1,
            status: 1,
            'story.name': 1,
            'story.slug': 1
          }
        }
      ]),

      // Monthly earnings (current month)
      Transaction.aggregate([
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(userId),
            type: 'income',
            reference_type: { $in: ['story', 'chapter'] },
            createdAt: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$amount' }
          }
        }
      ]).then(result => result[0]?.totalEarnings || 0)
    ]);

    // Calculate growth metrics (compare with previous month)
    const previousMonth = new Date();
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    
    const previousMonthEarnings = await Transaction.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          type: 'income',
          reference_type: { $in: ['story', 'chapter'] },
          createdAt: {
            $gte: new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1),
            $lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$amount' }
        }
      }
    ]).then(result => result[0]?.totalEarnings || 0);

    const earningsGrowth = previousMonthEarnings > 0 
      ? ((monthlyEarnings - previousMonthEarnings) / previousMonthEarnings * 100).toFixed(1)
      : monthlyEarnings > 0 ? 100 : 0;

    // Get top performing story
    const topStory = await Story.findOne({ author_id: author._id })
      .sort({ view: -1 })
      .select('name slug view')
      .lean();

    const dashboardData = {
      author: {
        id: author._id,
        name: author.name,
        slug: author.slug
      },
      statistics: {
        totalStories,
        totalChapters,
        totalViews,
        totalComments,
        monthlyEarnings,
        earningsGrowth: parseFloat(earningsGrowth)
      },
      recentActivity: {
        stories: recentStories,
        chapters: recentChapters
      },
      topPerforming: {
        story: topStory
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('[AuthorPanel] Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy dữ liệu dashboard',
      error: error.message
    });
  }
};

/**
 * Get author profile information
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAuthorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (isAdmin) {
      // For admin users, return a virtual profile
      return res.json({
        success: true,
        data: {
          author: {
            id: null,
            name: 'Admin User',
            slug: 'admin',
            approvalStatus: 'approved',
            approvalDate: new Date(),
            createdAt: new Date()
          },
          user: {
            name: req.user.name || 'Admin',
            email: req.user.email || 'admin@example.com',
            avatar: null,
            social: {}
          }
        }
      });
    }

    const author = await Author.findOne({
      userId: userId,
      authorType: 'system',
      approvalStatus: 'approved'
    }).populate('userId', 'name email avatar social');

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại'
      });
    }

    res.json({
      success: true,
      data: {
        author: {
          id: author._id,
          name: author.name,
          slug: author.slug,
          approvalStatus: author.approvalStatus,
          approvalDate: author.approvalDate,
          createdAt: author.createdAt
        },
        user: author.userId
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin tác giả',
      error: error.message
    });
  }
};

/**
 * Get recent activity feed
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const author = await Author.findOne({ 
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

    // Get recent activities (stories, chapters, comments)
    const activities = [];

    // Recent story updates
    const recentStories = await Story.find({ author_id: author._id })
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit) / 2)
      .select('name slug updatedAt createdAt')
      .lean();

    recentStories.forEach(story => {
      activities.push({
        type: 'story_update',
        title: `Cập nhật truyện: ${story.name}`,
        timestamp: story.updatedAt,
        data: story
      });
    });

    // Recent chapter publications
    const recentChapters = await Chapter.aggregate([
      {
        $lookup: {
          from: 'stories',
          localField: 'story_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      {
        $match: {
          'story.author_id': author._id
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $limit: parseInt(limit) / 2
      },
      {
        $project: {
          name: 1,
          chapter: 1,
          createdAt: 1,
          'story.name': 1,
          'story.slug': 1
        }
      }
    ]);

    recentChapters.forEach(chapter => {
      activities.push({
        type: 'chapter_published',
        title: `Xuất bản chapter: ${chapter.story[0]?.name} - ${chapter.name}`,
        timestamp: chapter.createdAt,
        data: chapter
      });
    });

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: activities.slice(0, parseInt(limit))
    });

  } catch (error) {
    console.error('[AuthorPanel] Get activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy hoạt động gần đây',
      error: error.message
    });
  }
};
