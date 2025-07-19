const mongoose = require('mongoose');
const Author = require('../../models/author');
const Story = require('../../models/story');
const Comment = require('../../models/comment');
const Rating = require('../../models/userRating');
const User = require('../../models/user');
const ReadingProgress = require('../../models/storiesReading');

// Helper function to get date range
const getDateRange = (timeRange) => {
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

  return { startDate, endDate: now };
};

// Get reader engagement analytics
exports.getReaderAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '30d' } = req.query;
    const { startDate, endDate } = getDateRange(timeRange);

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let storyFilter = {};

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

      storyFilter = { author_id: author._id };
    }

    console.log(`[AuthorPanel] Getting reader analytics for user: ${userId}, timeRange: ${timeRange}`);
    console.log(`[AuthorPanel] Date range: ${startDate} to ${endDate}`);
    console.log(`[AuthorPanel] Is admin: ${isAdmin}`);
    if (author) {
      console.log(`[AuthorPanel] Author ID: ${author._id}`);
      console.log(`[AuthorPanel] Author ID type: ${typeof author._id}`);
    }

    // First, let's check if there are any comments in the date range
    const totalCommentsInRange = await Comment.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    console.log(`[AuthorPanel] Total comments in date range: ${totalCommentsInRange}`);

    // Check author's stories
    const authorStories = await Story.find(isAdmin ? {} : { author_id: author._id }).select('_id name author_id');
    console.log(`[AuthorPanel] Author stories found: ${authorStories.length}`);
    if (authorStories.length > 0) {
      console.log(`[AuthorPanel] First story author_id: ${authorStories[0].author_id}, type: ${typeof authorStories[0].author_id}`);
    }

    // Get story IDs for filtering
    const storyIds = authorStories.map(story => story._id);
    console.log(`[AuthorPanel] Story IDs for filtering: ${storyIds.length} stories`);

    // Get most active readers
    const activeReaders = await Comment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          ...(isAdmin ? {} : { story_id: { $in: storyIds } })
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
        $group: {
          _id: '$user_id',
          commentCount: { $sum: 1 },
          user: { $first: { $arrayElemAt: ['$user', 0] } },
          lastActivity: { $max: '$createdAt' },
          stories: { $addToSet: '$story_id' }
        }
      },
      {
        $addFields: {
          storiesCount: { $size: '$stories' }
        }
      },
      {
        $sort: { commentCount: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          userId: '$_id',
          commentCount: 1,
          storiesCount: 1,
          lastActivity: 1,
          user: {
            name: '$user.name',
            avatar: '$user.avatar',
            slug: '$user.slug'
          }
        }
      }
    ]);

    console.log(`[AuthorPanel] Active readers found: ${activeReaders.length}`);

    // Get comment frequency trends
    const commentTrends = await Comment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          ...(isAdmin ? {} : { story_id: { $in: storyIds } })
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          commentCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user_id' }
        }
      },
      {
        $addFields: {
          uniqueUserCount: { $size: '$uniqueUsers' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Get reader retention metrics
    const readerRetention = await Comment.aggregate([
      {
        $match: {
          ...(isAdmin ? {} : { story_id: { $in: storyIds } })
        }
      },
      {
        $group: {
          _id: '$user_id',
          firstComment: { $min: '$createdAt' },
          lastComment: { $max: '$createdAt' },
          totalComments: { $sum: 1 }
        }
      },
      {
        $addFields: {
          daysBetween: {
            $divide: [
              { $subtract: ['$lastComment', '$firstComment'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalReaders: { $sum: 1 },
          returningReaders: {
            $sum: { $cond: [{ $gt: ['$daysBetween', 0] }, 1, 0] }
          },
          averageRetentionDays: { $avg: '$daysBetween' },
          averageCommentsPerReader: { $avg: '$totalComments' }
        }
      }
    ]);

    // Get comment sentiment analysis (simplified)
    const sentimentAnalysis = await Comment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          ...(isAdmin ? {} : { story_id: { $in: storyIds } })
        }
      },
      {
        $addFields: {
          sentiment: {
            $cond: [
              {
                $regexMatch: {
                  input: '$content',
                  regex: /(tuyệt vời|hay|thích|yêu|tốt|xuất sắc|amazing|great|love|good|excellent)/i
                }
              },
              'positive',
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: '$content',
                      regex: /(tệ|dở|không thích|boring|bad|hate|terrible)/i
                    }
                  },
                  'negative',
                  'neutral'
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$sentiment',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get popular discussion topics (keyword analysis)
    const popularTopics = await Comment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          ...(isAdmin ? {} : { story_id: { $in: storyIds } })
        }
      },
      {
        $project: {
          words: {
            $split: [
              {
                $toLower: {
                  $replaceAll: {
                    input: '$content',
                    find: /[^\w\s]/g,
                    replacement: ''
                  }
                }
              },
              ' '
            ]
          }
        }
      },
      {
        $unwind: '$words'
      },
      {
        $match: {
          words: { $nin: ['', 'và', 'của', 'có', 'là', 'với', 'trong', 'cho', 'về', 'từ', 'đã', 'sẽ', 'được', 'này', 'đó', 'một', 'các', 'những', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'] },
          $expr: { $gte: [{ $strLenCP: '$words' }, 3] }
        }
      },
      {
        $group: {
          _id: '$words',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 20
      }
    ]);

    const responseData = {
      activeReaders,
      commentTrends,
      readerRetention: readerRetention[0] || {
        totalReaders: 0,
        returningReaders: 0,
        averageRetentionDays: 0,
        averageCommentsPerReader: 0
      },
      sentimentAnalysis,
      popularTopics,
      timeRange
    };

    console.log(`[AuthorPanel] Reader analytics response:`, {
      activeReadersCount: activeReaders.length,
      commentTrendsCount: commentTrends.length,
      readerRetention: responseData.readerRetention,
      sentimentAnalysisCount: sentimentAnalysis.length,
      popularTopicsCount: popularTopics.length
    });

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('[AuthorPanel] Reader analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tải phân tích độc giả'
    });
  }
};

// Get rating analytics
exports.getRatingAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '30d', storyId = '' } = req.query;
    const { startDate, endDate } = getDateRange(timeRange);

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let storyFilter = {};

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

      storyFilter = { author_id: author._id };
    }

    // Build match conditions
    let matchConditions = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (storyId) {
      matchConditions.story_id = new mongoose.Types.ObjectId(storyId);
    }

    // Get rating distribution
    const ratingDistribution = await Rating.aggregate([
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
          'story.0': { $exists: true },
          ...matchConditions,
          ...(isAdmin ? {} : { 'story.author_id': author._id })
        }
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get rating trends over time
    const ratingTrends = await Rating.aggregate([
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
          'story.0': { $exists: true },
          ...matchConditions,
          ...(isAdmin ? {} : { 'story.author_id': author._id })
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          averageRating: { $avg: '$rating' },
          ratingCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Get story rating comparison
    const storyRatingComparison = await Rating.aggregate([
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
          'story.0': { $exists: true },
          ...matchConditions,
          ...(isAdmin ? {} : { 'story.author_id': author._id })
        }
      },
      {
        $group: {
          _id: '$story_id',
          averageRating: { $avg: '$rating' },
          ratingCount: { $sum: 1 },
          story: { $first: { $arrayElemAt: ['$story', 0] } }
        }
      },
      {
        $sort: { averageRating: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          storyId: '$_id',
          averageRating: { $round: ['$averageRating', 2] },
          ratingCount: 1,
          storyName: '$story.name',
          storySlug: '$story.slug'
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        ratingDistribution,
        ratingTrends,
        storyRatingComparison,
        timeRange
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Rating analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tải phân tích đánh giá'
    });
  }
};
