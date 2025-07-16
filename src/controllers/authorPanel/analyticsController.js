const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const Author = require('../../models/author');
const Comment = require('../../models/comment');
const UserRating = require('../../models/userRating');
const StoriesReading = require('../../models/storiesReading');
const mongoose = require('mongoose');

/**
 * Get analytics overview for author
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAnalyticsOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '30d' } = req.query;

    // Check if user is admin (admins can view all analytics)
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let authorFilter = {};

    if (isAdmin) {
      // Admin users can view analytics for all stories
      authorFilter = {}; // No filter = all stories
    } else {
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

      authorFilter = { author_id: author._id };
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
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get analytics data
    const [
      totalViews,
      totalComments,
      totalRatings,
      averageRating,
      topStories,
      recentActivity
    ] = await Promise.all([
      // Total views across all stories
      Story.aggregate([
        { $match: authorFilter },
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
          $match: isAdmin ? {
            createdAt: { $gte: startDate }
          } : {
            'story.author_id': author._id,
            createdAt: { $gte: startDate }
          }
        },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),

      // Total ratings
      UserRating.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: isAdmin ? {
            createdAt: { $gte: startDate }
          } : {
            'story.author_id': author._id,
            createdAt: { $gte: startDate }
          }
        },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),

      // Average rating
      UserRating.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: isAdmin ? {} : {
            'story.author_id': author._id
          }
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' }
          }
        }
      ]).then(result => result[0]?.averageRating || 0),

      // Top performing stories
      Story.find(authorFilter)
        .sort({ view: -1 })
        .limit(5)
        .select('name slug view like comment')
        .lean(),

      // Recent reading activity
      StoriesReading.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: isAdmin ? {
            updatedAt: { $gte: startDate }
          } : {
            'story.author_id': author._id,
            updatedAt: { $gte: startDate }
          }
        },
        {
          $sort: { updatedAt: -1 }
        },
        {
          $limit: 10
        },
        {
          $project: {
            'story.name': 1,
            'story.slug': 1,
            'current_chapter.chapter_number': 1,
            updatedAt: 1
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalViews,
          totalComments,
          totalRatings,
          averageRating: Math.round(averageRating * 10) / 10
        },
        topStories,
        recentActivity,
        timeRange
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Analytics overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy dữ liệu analytics',
      error: error.message
    });
  }
};

/**
 * Get detailed story analytics
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getStoryAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storyId } = req.params;
    const { timeRange = '30d' } = req.query;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let story = null;

    if (isAdmin) {
      // Admin users can view analytics for any story
      story = await Story.findById(storyId);
    } else {
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

      // Verify story belongs to author
      story = await Story.findOne({
        _id: storyId,
        author_id: author._id
      });
    }

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại hoặc bạn không có quyền truy cập'
      });
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
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get story analytics
    const [
      chapterCount,
      totalComments,
      totalRatings,
      averageRating,
      recentComments,
      chapterPerformance
    ] = await Promise.all([
      // Chapter count
      Chapter.countDocuments({ story_id: storyId }),

      // Comments in time range
      Comment.countDocuments({ 
        story_id: storyId,
        createdAt: { $gte: startDate }
      }),

      // Ratings in time range
      UserRating.countDocuments({ 
        story_id: storyId,
        createdAt: { $gte: startDate }
      }),

      // Average rating
      UserRating.aggregate([
        { $match: { story_id: new mongoose.Types.ObjectId(storyId) } },
        { $group: { _id: null, averageRating: { $avg: '$rating' } } }
      ]).then(result => result[0]?.averageRating || 0),

      // Recent comments
      Comment.find({ story_id: storyId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user_id', 'name avatar')
        .select('content createdAt')
        .lean(),

      // Chapter performance (views by chapter)
      Chapter.find({ story_id: storyId })
        .sort({ chapter: 1 })
        .select('name chapter view createdAt')
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        story: {
          id: story._id,
          name: story.name,
          slug: story.slug,
          view: story.view,
          like: story.like,
          comment: story.comment
        },
        analytics: {
          chapterCount,
          totalComments,
          totalRatings,
          averageRating: Math.round(averageRating * 10) / 10
        },
        recentComments,
        chapterPerformance,
        timeRange
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Story analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy analytics truyện',
      error: error.message
    });
  }
};

/**
 * Get chapter performance analytics
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getChapterAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let chapter = null;

    if (isAdmin) {
      // Admin users can view analytics for any chapter
      chapter = await Chapter.findById(chapterId)
        .populate({
          path: 'story_id',
          select: 'name slug author_id'
        })
        .lean();
    } else {
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

      // Get chapter with story info to verify ownership
      chapter = await Chapter.findById(chapterId)
        .populate({
          path: 'story_id',
          select: 'name slug author_id',
          match: { author_id: author._id }
        })
        .lean();
    }

    if (!chapter || !chapter.story_id) {
      return res.status(404).json({
        success: false,
        message: 'Chapter không tồn tại hoặc bạn không có quyền truy cập'
      });
    }

    // Get chapter analytics
    const [
      commentCount,
      readingProgress
    ] = await Promise.all([
      // Comments on this chapter
      Comment.countDocuments({
        story_id: chapter.story_id._id,
        chapter_id: chapterId
      }),

      // Reading progress data
      StoriesReading.countDocuments({
        story_id: chapter.story_id._id,
        'current_chapter.chapter_number': { $gte: chapter.chapter }
      })
    ]);

    res.json({
      success: true,
      data: {
        chapter: {
          id: chapter._id,
          name: chapter.name,
          chapter: chapter.chapter,
          view: chapter.view || 0,
          createdAt: chapter.createdAt
        },
        story: chapter.story_id,
        analytics: {
          commentCount,
          readingProgress
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Chapter analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy analytics chapter',
      error: error.message
    });
  }
};

/**
 * Get engagement metrics
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getEngagementMetrics = async (req, res) => {
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
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get engagement metrics
    const [
      newFollowers,
      activeReaders,
      commentEngagement,
      ratingTrends
    ] = await Promise.all([
      // New followers/readers (users who started reading in time range)
      StoriesReading.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: isAdmin ? {
            createdAt: { $gte: startDate }
          } : {
            'story.author_id': author._id,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$user_id'
          }
        },
        {
          $count: 'total'
        }
      ]).then(result => result[0]?.total || 0),

      // Active readers (users who read in time range)
      StoriesReading.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: isAdmin ? {
            updatedAt: { $gte: startDate }
          } : {
            'story.author_id': author._id,
            updatedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$user_id'
          }
        },
        {
          $count: 'total'
        }
      ]).then(result => result[0]?.total || 0),

      // Comment engagement by day
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
          $match: isAdmin ? {
            createdAt: { $gte: startDate }
          } : {
            'story.author_id': author._id,
            createdAt: { $gte: startDate }
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
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]),

      // Rating trends
      UserRating.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: isAdmin ? {
            createdAt: { $gte: startDate }
          } : {
            'story.author_id': author._id,
            createdAt: { $gte: startDate }
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
            averageRating: { $avg: '$rating' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        metrics: {
          newFollowers,
          activeReaders,
          engagementRate: activeReaders > 0 ? (commentEngagement.length / activeReaders * 100).toFixed(1) : 0
        },
        trends: {
          comments: commentEngagement,
          ratings: ratingTrends
        },
        timeRange
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Engagement metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy metrics engagement',
      error: error.message
    });
  }
};

/**
 * Get view statistics
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getViewStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '30d', storyId } = req.query;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let query = {};

    if (isAdmin) {
      // Admin users can view statistics for all stories
      query = {};
      if (storyId) {
        query._id = new mongoose.Types.ObjectId(storyId);
      }
    } else {
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

      // Build query for author's stories
      query = { author_id: author._id };
      if (storyId) {
        query._id = new mongoose.Types.ObjectId(storyId);
      }
    }

    // Get view statistics
    const stories = await Story.find(query)
      .select('name slug view createdAt updatedAt')
      .sort({ view: -1 })
      .lean();

    // Calculate total views
    const totalViews = stories.reduce((sum, story) => sum + (story.view || 0), 0);

    res.json({
      success: true,
      data: {
        totalViews,
        stories: stories.map(story => ({
          id: story._id,
          name: story.name,
          slug: story.slug,
          views: story.view || 0,
          createdAt: story.createdAt,
          updatedAt: story.updatedAt
        })),
        timeRange
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] View statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê lượt xem',
      error: error.message
    });
  }
};
