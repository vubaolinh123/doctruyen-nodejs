const mongoose = require('mongoose');
const moderationService = require('../../services/comment/moderationService');
const cacheService = require('../../services/comment/cacheService');

/**
 * Controller cho comment moderation
 */
class ModerationController {

  /**
   * Lấy queue comments cần moderation với advanced filtering
   * @route GET /api/admin/comments/queue
   */
  async getModerationQueue(req, res) {
    try {
      const {
        page = 1,
        limit = 100,
        search = '',
        sort = 'createdAt',
        direction = 'desc',
        status = 'all',
        type = 'all',
        flagged = 'all',
        dateFrom,
        dateTo,
        storyId,
        userId
      } = req.query;

      const Comment = require('../../models/comment');

      // Build query filters
      let query = {};

      // Status filter
      if (status !== 'all') {
        query['moderation.status'] = status;
      }

      // Type filter (story vs chapter comments)
      if (type !== 'all') {
        query['target.type'] = type;
      }

      // Flagged filter
      if (flagged === 'true') {
        query['moderation.flags.count'] = { $gt: 0 };
      } else if (flagged === 'false') {
        query['moderation.flags.count'] = { $eq: 0 };
      }

      // Date range filter
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Story filter
      if (storyId) {
        query['target.story_id'] = storyId;
      }

      // User filter
      if (userId) {
        query.user_id = userId;
      }

      // Search filter
      if (search) {
        query.$or = [
          { 'content.original': { $regex: search, $options: 'i' } },
          { 'content.sanitized': { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build sort object
      const sortObj = {};
      sortObj[sort] = direction === 'asc' ? 1 : -1;

      // Execute query with pagination
      const [comments, total] = await Promise.all([
        Comment.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .populate('user_id', 'name email avatar slug')
          .populate('target.story_id', 'title slug')
          .populate('target.chapter_id', 'title chapter_number')
          .populate('moderation.moderated_by', 'name')
          .lean(),
        Comment.countDocuments(query)
      ]);

      // Format response
      const pagination = {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      };

      res.json({
        success: true,
        data: comments,
        pagination
      });
    } catch (error) {
      console.error('Error getting moderation queue:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách bình luận'
      });
    }
  }

  /**
   * Thực hiện moderation action
   * @route POST /api/admin/comments/:id/moderate
   */
  async moderateComment(req, res) {
    try {
      const { id } = req.params;
      const moderatorId = req.user._id || req.user.id;
      const { action, reason = '' } = req.body;

      const result = await moderationService.moderateComment(id, moderatorId, action, reason);

      // Invalidate cache
      cacheService.invalidateOnCommentUpdate({ _id: id });

      res.json(result);
    } catch (error) {
      console.error('Error moderating comment:', error);

      if (error.message.includes('không tồn tại')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi kiểm duyệt bình luận'
      });
    }
  }

  /**
   * Bulk moderation cho nhiều comments
   * @route POST /api/admin/comments/bulk-moderate
   */
  async bulkModerateComments(req, res) {
    try {
      const { comment_ids, action, reason = '' } = req.body;
      const moderatorId = req.user._id;

      if (!Array.isArray(comment_ids) || comment_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách comment IDs không hợp lệ'
        });
      }

      if (comment_ids.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Không thể xử lý quá 100 bình luận cùng lúc'
        });
      }

      const result = await moderationService.bulkModerateComments(
        comment_ids,
        moderatorId,
        action,
        reason
      );

      // Invalidate cache
      cacheService.clearAll(); // Clear all cache for bulk operations

      res.json(result);
    } catch (error) {
      console.error('Error bulk moderating comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi kiểm duyệt hàng loạt'
      });
    }
  }

  /**
   * Auto moderation
   * @route POST /api/admin/comments/auto-moderate
   */
  async autoModeration(req, res) {
    try {
      const {
        spam_threshold = 0.8,
        toxicity_threshold = 0.8,
        flag_threshold = 5,
        limit = 100
      } = req.body;

      const options = {
        spam_threshold: parseFloat(spam_threshold),
        toxicity_threshold: parseFloat(toxicity_threshold),
        flag_threshold: parseInt(flag_threshold),
        limit: parseInt(limit)
      };

      const result = await moderationService.autoModeration(options);

      // Invalidate cache
      cacheService.clearAll();

      res.json(result);
    } catch (error) {
      console.error('Error in auto moderation:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi thực hiện tự động kiểm duyệt'
      });
    }
  }

  /**
   * Analyze comment content
   * @route POST /api/admin/comments/:id/analyze
   */
  async analyzeComment(req, res) {
    try {
      const { id } = req.params;

      const Comment = require('../../models/comment');
      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Bình luận không tồn tại'
        });
      }

      const result = await moderationService.analyzeComment(comment);

      res.json(result);
    } catch (error) {
      console.error('Error analyzing comment:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi phân tích bình luận'
      });
    }
  }

  /**
   * Lấy thống kê moderation
   * @route GET /api/admin/comments/moderation-stats
   */
  async getModerationStats(req, res) {
    try {
      const { timeRange = '7d' } = req.query;

      const options = { timeRange };
      const result = await moderationService.getModerationStats(options);

      res.json(result);
    } catch (error) {
      console.error('Error getting moderation stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy thống kê kiểm duyệt'
      });
    }
  }

  /**
   * Lấy danh sách comments bị flag nhiều
   * @route GET /api/admin/comments/highly-flagged
   */
  async getHighlyFlaggedComments(req, res) {
    try {
      const {
        min_flags = 3,
        limit = 50,
        skip = 0
      } = req.query;

      const Comment = require('../../models/comment');
      const comments = await Comment.find({
        'moderation.flags.count': { $gte: parseInt(min_flags) },
        'moderation.status': { $in: ['active', 'pending'] }
      })
        .sort({ 'moderation.flags.count': -1, createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('user_id', 'name avatar slug')
        .populate('target.story_id', 'title slug')
        .populate('target.chapter_id', 'title chapter_number')
        .lean();

      const total = await Comment.countDocuments({
        'moderation.flags.count': { $gte: parseInt(min_flags) },
        'moderation.status': { $in: ['active', 'pending'] }
      });

      res.json({
        success: true,
        data: comments,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error getting highly flagged comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy bình luận bị báo cáo nhiều'
      });
    }
  }

  /**
   * Lấy danh sách comments có spam/toxicity score cao
   * @route GET /api/admin/comments/suspicious
   */
  async getSuspiciousComments(req, res) {
    try {
      const {
        min_spam_score = 0.7,
        min_toxicity_score = 0.7,
        limit = 50,
        skip = 0
      } = req.query;

      const Comment = require('../../models/comment');
      const comments = await Comment.find({
        $or: [
          { 'moderation.auto_moderation.spam_score': { $gte: parseFloat(min_spam_score) } },
          { 'moderation.auto_moderation.toxicity_score': { $gte: parseFloat(min_toxicity_score) } }
        ],
        'moderation.status': { $in: ['active', 'pending'] }
      })
        .sort({
          'moderation.auto_moderation.spam_score': -1,
          'moderation.auto_moderation.toxicity_score': -1,
          createdAt: -1
        })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('user_id', 'name avatar slug')
        .populate('target.story_id', 'title slug')
        .populate('target.chapter_id', 'title chapter_number')
        .lean();

      const total = await Comment.countDocuments({
        $or: [
          { 'moderation.auto_moderation.spam_score': { $gte: parseFloat(min_spam_score) } },
          { 'moderation.auto_moderation.toxicity_score': { $gte: parseFloat(min_toxicity_score) } }
        ],
        'moderation.status': { $in: ['active', 'pending'] }
      });

      res.json({
        success: true,
        data: comments,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error getting suspicious comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy bình luận đáng nghi'
      });
    }
  }

  /**
   * Lấy lịch sử moderation của một comment
   * @route GET /api/admin/comments/:id/moderation-history
   */
  async getModerationHistory(req, res) {
    try {
      const { id } = req.params;

      const Comment = require('../../models/comment');
      const comment = await Comment.findById(id)
        .populate('moderation.moderated_by', 'name')
        .populate('moderation.flags.flagged_by.user_id', 'name')
        .lean();

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Bình luận không tồn tại'
        });
      }

      const history = {
        current_status: comment.moderation.status,
        moderated_by: comment.moderation.moderated_by,
        moderated_at: comment.moderation.moderated_at,
        moderation_reason: comment.moderation.moderation_reason,
        flags: comment.moderation.flags,
        auto_moderation: comment.moderation.auto_moderation,
        edit_history: comment.metadata.edit_history || []
      };

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting moderation history:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy lịch sử kiểm duyệt'
      });
    }
  }

  /**
   * Reset flags của comment
   * @route POST /api/admin/comments/:id/reset-flags
   */
  async resetFlags(req, res) {
    try {
      const { id } = req.params;
      const { reason = 'Admin reset flags' } = req.body;

      const Comment = require('../../models/comment');
      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Bình luận không tồn tại'
        });
      }

      // Reset flags
      comment.moderation.flags.count = 0;
      comment.moderation.flags.reasons = [];
      comment.moderation.flags.flagged_by = [];
      comment.moderation.moderated_by = req.user._id;
      comment.moderation.moderated_at = new Date();
      comment.moderation.moderation_reason = reason;

      await comment.save();

      res.json({
        success: true,
        message: 'Đã reset flags thành công',
        data: {
          comment_id: id,
          flags_reset: true
        }
      });
    } catch (error) {
      console.error('Error resetting flags:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi reset flags'
      });
    }
  }

  /**
   * Lấy analytics data cho comments
   * @route GET /api/admin/comments/analytics
   */
  async getCommentAnalytics(req, res) {
    try {
      const {
        period = 'daily',
        days = 30,
        weeks = 12,
        months = 12,
        startDate,
        endDate
      } = req.query;

      const Comment = require('../../models/comment');

      // Determine date range
      let dateRange = {};
      const now = new Date();

      if (startDate && endDate) {
        dateRange = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      } else {
        switch (period) {
          case 'daily':
            dateRange = {
              createdAt: {
                $gte: new Date(now.getTime() - (parseInt(days) * 24 * 60 * 60 * 1000))
              }
            };
            break;
          case 'weekly':
            dateRange = {
              createdAt: {
                $gte: new Date(now.getTime() - (parseInt(weeks) * 7 * 24 * 60 * 60 * 1000))
              }
            };
            break;
          case 'monthly':
            dateRange = {
              createdAt: {
                $gte: new Date(now.getTime() - (parseInt(months) * 30 * 24 * 60 * 60 * 1000))
              }
            };
            break;
        }
      }

      // Build aggregation pipeline
      const pipeline = [
        { $match: dateRange },
        {
          $group: {
            _id: {
              $dateToString: {
                format: period === 'daily' ? '%Y-%m-%d' :
                       period === 'weekly' ? '%Y-%U' : '%Y-%m',
                date: '$createdAt',
                timezone: 'Asia/Saigon'
              }
            },
            totalComments: { $sum: 1 },
            activeComments: {
              $sum: { $cond: [{ $eq: ['$moderation.status', 'active'] }, 1, 0] }
            },
            pendingComments: {
              $sum: { $cond: [{ $eq: ['$moderation.status', 'pending'] }, 1, 0] }
            },
            flaggedComments: {
              $sum: { $cond: [{ $gt: ['$moderation.flags.count', 0] }, 1, 0] }
            },
            deletedComments: {
              $sum: { $cond: [{ $eq: ['$moderation.status', 'deleted'] }, 1, 0] }
            }
          }
        },
        { $sort: { '_id': 1 } }
      ];

      const stats = await Comment.aggregate(pipeline);

      // Format response data
      const formattedStats = stats.map(stat => ({
        [period === 'daily' ? 'date' : period === 'weekly' ? 'week' : 'month']: stat._id,
        totalComments: stat.totalComments,
        activeComments: stat.activeComments,
        pendingComments: stat.pendingComments,
        flaggedComments: stat.flaggedComments,
        deletedComments: stat.deletedComments
      }));

      // Calculate summary
      const totalComments = formattedStats.reduce((sum, stat) => sum + stat.totalComments, 0);
      const averagePerPeriod = formattedStats.length > 0 ? Math.round(totalComments / formattedStats.length) : 0;
      const peakComments = formattedStats.length > 0 ? Math.max(...formattedStats.map(stat => stat.totalComments)) : 0;

      const response = {
        period,
        timezone: 'Asia/Saigon',
        stats: formattedStats,
        summary: {
          totalComments,
          averagePerPeriod,
          peakComments,
          dataPoints: formattedStats.length
        }
      };

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      console.error('Error getting comment analytics:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy dữ liệu thống kê bình luận'
      });
    }
  }

  /**
   * Lấy danh sách truyện có bình luận - Simplified version
   * @route GET /api/admin/comments/stories
   */
  async getStoriesWithComments(req, res) {
    try {
      const {
        page = 1,
        limit = 100,
        search = '',
        sort = 'totalComments',
        direction = 'desc',
        status = 'all',
        moderationStatus = 'all',
        minComments = '',
        maxComments = '',
        dateFrom,
        dateTo
      } = req.query;

      console.log('🔍 [getStoriesWithComments] Request params:', {
        page, limit, search, sort, direction, status, moderationStatus,
        minComments, maxComments, dateFrom, dateTo
      });

      const Comment = require('../../models/comment');
      const Story = require('../../models/story');
      const User = require('../../models/user');

      // Validate required models
      if (!Comment || !Story || !User) {
        throw new Error('Required models not found');
      }

      // Get collection names from Mongoose models
      const commentCollectionName = Comment.collection.name;
      const storyCollectionName = Story.collection.name;
      const userCollectionName = User.collection.name;

      console.log('📋 [getStoriesWithComments] Model collection names:');
      console.log('  - Comment collection:', commentCollectionName);
      console.log('  - Story collection:', storyCollectionName);
      console.log('  - User collection:', userCollectionName);

      // First, let's check if we have any comments at all
      const totalComments = await Comment.countDocuments();
      console.log('📊 [getStoriesWithComments] Total comments in database:', totalComments);

      if (totalComments === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: parseInt(limit),
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      }

      // Check comments with story_id
      const commentsWithStoryId = await Comment.countDocuments({ 'target.story_id': { $exists: true, $ne: null } });
      console.log('📊 [getStoriesWithComments] Comments with story_id:', commentsWithStoryId);

      // Sample a few comments to check structure
      const sampleComments = await Comment.find({}).limit(3).select('target moderation createdAt');
      console.log('📋 [getStoriesWithComments] Sample comments count:', sampleComments.length);

      // Safe logging with error handling
      try {
        if (sampleComments.length > 0) {
          console.log('📋 [getStoriesWithComments] First sample comment structure:');
          console.log('  - target:', sampleComments[0].target);
          console.log('  - moderation status:', sampleComments[0].moderation?.status);
          console.log('  - createdAt:', sampleComments[0].createdAt);
        }
      } catch (logError) {
        console.log('📋 [getStoriesWithComments] Error logging sample comments:', logError.message);
      }

      // Build match stage with proper validation
      const matchStage = {
        'target.story_id': { $exists: true, $ne: null },
        'target': { $exists: true, $ne: null },
        'moderation': { $exists: true, $ne: null }
      };

      // Add status filter only if not 'all'
      if (status && status !== 'all') {
        matchStage['moderation.status'] = status;
      }

      // Add date range filter if provided
      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) {
          matchStage.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          matchStage.createdAt.$lte = new Date(dateTo);
        }
      }

      console.log('🔍 [getStoriesWithComments] Match stage:', JSON.stringify(matchStage, null, 2));

      // Build the aggregation pipeline step by step
      const pipeline = [
        // Match comments based on filters
        { $match: matchStage },

        // Group by story to get comment counts
        {
          $group: {
            _id: '$target.story_id',
            totalComments: { $sum: 1 },
            activeComments: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.status', 'active'] },
                  1,
                  0
                ]
              }
            },
            pendingComments: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.status', 'pending'] },
                  1,
                  0
                ]
              }
            },
            flaggedComments: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$moderation.flags.count', 0] },
                      { $gt: [{ $ifNull: ['$moderation.flags.count', 0] }, 0] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            lastCommentDate: { $max: '$createdAt' }
          }
        }
      ];

      // Add comment count filters if provided
      if (minComments && !isNaN(parseInt(minComments))) {
        pipeline.push({ $match: { totalComments: { $gte: parseInt(minComments) } } });
      }

      if (maxComments && !isNaN(parseInt(maxComments))) {
        pipeline.push({ $match: { totalComments: { $lte: parseInt(maxComments) } } });
      }

      // Add lookup stages using actual collection names
      pipeline.push(
        // Lookup story details
        {
          $lookup: {
            from: storyCollectionName,
            localField: '_id',
            foreignField: '_id',
            as: 'story'
          }
        },

        // Filter out stories that don't exist
        { $match: { 'story.0': { $exists: true } } },

        // Unwind story
        { $unwind: '$story' },

        // Unwind author_id array first (since author_id is an array)
        { $unwind: { path: '$story.author_id', preserveNullAndEmptyArrays: true } },

        // Lookup author details from Author collection
        {
          $lookup: {
            from: 'authors',
            localField: 'story.author_id',
            foreignField: '_id',
            as: 'author'
          }
        },

        // Unwind author with preserveNullAndEmptyArrays
        { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } }
      );

      // Add project stage with better null handling
      pipeline.push({
        $project: {
          _id: '$story._id',
          title: { $ifNull: ['$story.name', 'Unknown Title'] },
          slug: { $ifNull: ['$story.slug', 'unknown-slug'] },
          image: { $ifNull: ['$story.image', ''] },
          author: {
            $cond: [
              { $ne: ['$author', null] },
              {
                _id: { $ifNull: ['$author._id', null] },
                name: { $ifNull: ['$author.name', 'Unknown Author'] },
                slug: { $ifNull: ['$author.slug', 'unknown-author'] }
              },
              {
                _id: null,
                name: 'Unknown Author',
                slug: 'unknown-author'
              }
            ]
          },
          totalComments: 1,
          activeComments: 1,
          pendingComments: 1,
          flaggedComments: 1,
          lastCommentDate: 1,
          moderationStatus: {
            $cond: [
              { $gt: ['$flaggedComments', 5] }, 'flagged',
              { $cond: [
                { $gt: ['$pendingComments', 0] }, 'needs_review',
                'clean'
              ]}
            ]
          },
          createdAt: { $ifNull: ['$story.createdAt', new Date()] },
          updatedAt: { $ifNull: ['$story.updatedAt', new Date()] }
        }
      });

      // Add search filter if provided
      if (search && search.trim()) {
        pipeline.push({
          $match: {
            $or: [
              { title: { $regex: search.trim(), $options: 'i' } },
              { 'author.name': { $regex: search.trim(), $options: 'i' } }
            ]
          }
        });
      }

      // Add moderation status filter if provided
      if (moderationStatus && moderationStatus !== 'all') {
        pipeline.push({ $match: { moderationStatus } });
      }

      // Add sort stage
      const sortField = sort || 'totalComments';
      const sortDirection = direction === 'asc' ? 1 : -1;
      pipeline.push({ $sort: { [sortField]: sortDirection } });

      // Execute aggregation with pagination
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 100;
      const skip = (pageNum - 1) * limitNum;

      console.log('🔧 [getStoriesWithComments] Executing aggregation pipeline...');
      console.log('📋 [getStoriesWithComments] Pipeline stages count:', pipeline.length);

      // Test just the grouping stage first to see if we get any results
      console.log('🧪 [getStoriesWithComments] Testing group stage...');
      const groupTestResult = await Comment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$target.story_id',
            totalComments: { $sum: 1 },
            activeComments: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.status', 'active'] },
                  1,
                  0
                ]
              }
            },
            pendingComments: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.status', 'pending'] },
                  1,
                  0
                ]
              }
            },
            flaggedComments: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$moderation.flags.count', 0] },
                      { $gt: [{ $ifNull: ['$moderation.flags.count', 0] }, 0] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            lastCommentDate: { $max: '$createdAt' }
          }
        }
      ]);

      console.log('📊 [getStoriesWithComments] Group stage result count:', groupTestResult.length);
      if (groupTestResult.length > 0) {
        try {
          const firstResult = groupTestResult[0];
          console.log('📋 [getStoriesWithComments] First group result:');
          console.log('  - _id (story_id):', firstResult._id);
          console.log('  - totalComments:', firstResult.totalComments);
          console.log('  - activeComments:', firstResult.activeComments);
          console.log('  - pendingComments:', firstResult.pendingComments);
          console.log('  - flaggedComments:', firstResult.flaggedComments);
          console.log('  - lastCommentDate:', firstResult.lastCommentDate);

          // Validate that the referenced story exists
          const storyExists = await Story.findById(firstResult._id);
          console.log('📋 [getStoriesWithComments] Story exists check:', !!storyExists);
          if (storyExists) {
            console.log('  - Story title:', storyExists.name);
            console.log('  - Story author_id:', storyExists.author_id);

            // Check if author exists
            if (storyExists.author_id && storyExists.author_id.length > 0) {
              const Author = require('../../models/author');
              const authorExists = await Author.findById(storyExists.author_id[0]);
              console.log('  - Author exists:', !!authorExists);
              if (authorExists) {
                console.log('  - Author name:', authorExists.name);
              }
            }
          }
        } catch (logError) {
          console.log('📋 [getStoriesWithComments] Error logging group result:', logError.message);
        }
      }

      // If no grouped results, return empty
      if (groupTestResult.length === 0) {
        console.log('⚠️ [getStoriesWithComments] No stories found with comments');
        return res.json({
          success: true,
          data: [],
          pagination: {
            currentPage: pageNum,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limitNum,
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      }

      // Execute pipeline stage by stage for debugging
      console.log('🚀 [getStoriesWithComments] Executing pipeline stage by stage...');

      // Test each stage incrementally
      let currentPipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: '$target.story_id',
            totalComments: { $sum: 1 },
            activeComments: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.status', 'active'] },
                  1,
                  0
                ]
              }
            },
            pendingComments: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.status', 'pending'] },
                  1,
                  0
                ]
              }
            },
            flaggedComments: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$moderation.flags.count', 0] },
                      { $gt: [{ $ifNull: ['$moderation.flags.count', 0] }, 0] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            lastCommentDate: { $max: '$createdAt' }
          }
        }
      ];

      // Test after group stage
      let stageResult = await Comment.aggregate(currentPipeline);
      console.log('📊 [Stage Debug] After group stage:', stageResult.length, 'results');

      // Add first lookup stage
      currentPipeline.push({
        $lookup: {
          from: storyCollectionName,
          localField: '_id',
          foreignField: '_id',
          as: 'story'
        }
      });

      stageResult = await Comment.aggregate(currentPipeline);
      console.log('📊 [Stage Debug] After story lookup:', stageResult.length, 'results');
      if (stageResult.length > 0) {
        console.log('  - First result story array length:', stageResult[0].story?.length || 0);
      }

      // Add story filter
      currentPipeline.push({ $match: { 'story.0': { $exists: true } } });
      stageResult = await Comment.aggregate(currentPipeline);
      console.log('📊 [Stage Debug] After story filter:', stageResult.length, 'results');

      // Add unwind story
      currentPipeline.push({ $unwind: '$story' });
      stageResult = await Comment.aggregate(currentPipeline);
      console.log('📊 [Stage Debug] After story unwind:', stageResult.length, 'results');

      // Add unwind author_id array
      currentPipeline.push({ $unwind: { path: '$story.author_id', preserveNullAndEmptyArrays: true } });
      stageResult = await Comment.aggregate(currentPipeline);
      console.log('📊 [Stage Debug] After author_id unwind:', stageResult.length, 'results');

      // Add author lookup
      currentPipeline.push({
        $lookup: {
          from: 'authors',
          localField: 'story.author_id',
          foreignField: '_id',
          as: 'author'
        }
      });

      stageResult = await Comment.aggregate(currentPipeline);
      console.log('📊 [Stage Debug] After author lookup:', stageResult.length, 'results');
      if (stageResult.length > 0) {
        console.log('  - First result author array length:', stageResult[0].author?.length || 0);
        if (stageResult[0].author && stageResult[0].author.length > 0) {
          console.log('  - Author name:', stageResult[0].author[0].name);
        }
      }

      // Add author unwind with preserveNullAndEmptyArrays
      currentPipeline.push({ $unwind: { path: '$author', preserveNullAndEmptyArrays: true } });
      stageResult = await Comment.aggregate(currentPipeline);
      console.log('📊 [Stage Debug] After author unwind:', stageResult.length, 'results');

      // Execute full pipeline
      console.log('🚀 [getStoriesWithComments] Executing full pipeline...');
      const [stories, totalCount] = await Promise.all([
        Comment.aggregate([
          ...pipeline,
          { $skip: skip },
          { $limit: limitNum }
        ]).catch(err => {
          console.error('❌ [getStoriesWithComments] Pipeline execution error:', err);
          throw err;
        }),
        Comment.aggregate([
          ...pipeline,
          { $count: 'total' }
        ]).catch(err => {
          console.error('❌ [getStoriesWithComments] Count pipeline error:', err);
          throw err;
        })
      ]);

      const total = totalCount[0]?.total || 0;

      console.log('📊 [getStoriesWithComments] Final results:', {
        storiesCount: stories.length,
        total: total,
        pagination: { pageNum, limitNum, skip }
      });

      if (stories.length > 0) {
        try {
          console.log('📋 [getStoriesWithComments] First story result:');
          console.log('  - _id:', stories[0]._id);
          console.log('  - title:', stories[0].title);
          console.log('  - author:', stories[0].author?.name);
          console.log('  - totalComments:', stories[0].totalComments);
          console.log('  - moderationStatus:', stories[0].moderationStatus);
        } catch (logError) {
          console.log('📋 [getStoriesWithComments] Error logging story result:', logError.message);
        }
      }

      // Format pagination
      const pagination = {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1
      };

      res.json({
        success: true,
        data: stories || [],
        pagination
      });
    } catch (error) {
      console.error('❌ [getStoriesWithComments] Error:', error);
      console.error('❌ [getStoriesWithComments] Stack trace:', error.stack);

      // Provide more specific error messages
      let errorMessage = 'Lỗi khi lấy danh sách truyện có bình luận';

      if (error.message) {
        if (error.message.includes('Cannot convert undefined or null to object')) {
          errorMessage = 'Lỗi xử lý dữ liệu: Có trường dữ liệu không hợp lệ';
        } else if (error.message.includes('$lookup')) {
          errorMessage = 'Lỗi kết nối dữ liệu giữa các collection';
        } else if (error.message.includes('$group')) {
          errorMessage = 'Lỗi nhóm dữ liệu bình luận';
        } else {
          errorMessage = error.message;
        }
      }

      res.status(500).json({
        success: false,
        message: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? {
          originalError: error.message,
          stack: error.stack
        } : undefined
      });
    }
  }

  /**
   * Lấy thống kê bình luận theo truyện
   * @route GET /api/admin/comments/stories/stats
   */
  async getStoryCommentStats(req, res) {
    try {
      const Comment = require('../../models/comment');
      const Story = require('../../models/story');

      // Get basic stats
      const [commentStats, storyStats, topStory] = await Promise.all([
        // Total comments and stories with comments
        Comment.aggregate([
          {
            $group: {
              _id: '$target.story_id',
              commentCount: { $sum: 1 }
            }
          },
          {
            $group: {
              _id: null,
              storiesWithComments: { $sum: 1 },
              totalComments: { $sum: '$commentCount' },
              averageCommentsPerStory: { $avg: '$commentCount' }
            }
          }
        ]),

        // Total stories
        Story.countDocuments(),

        // Most commented story
        Comment.aggregate([
          {
            $group: {
              _id: '$target.story_id',
              commentCount: { $sum: 1 }
            }
          },
          { $sort: { commentCount: -1 } },
          { $limit: 1 },
          {
            $lookup: {
              from: 'stories',
              localField: '_id',
              foreignField: '_id',
              as: 'story'
            }
          },
          { $unwind: '$story' },
          {
            $project: {
              title: '$story.name',
              commentCount: 1
            }
          }
        ])
      ]);

      const stats = commentStats[0] || {
        storiesWithComments: 0,
        totalComments: 0,
        averageCommentsPerStory: 0
      };

      const response = {
        totalStories: storyStats,
        storiesWithComments: stats.storiesWithComments,
        averageCommentsPerStory: Math.round(stats.averageCommentsPerStory || 0),
        mostCommentedStory: topStory[0] || {
          title: 'Chưa có dữ liệu',
          commentCount: 0
        }
      };

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      console.error('Error getting story comment stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy thống kê bình luận theo truyện'
      });
    }
  }

  /**
   * Lấy danh sách chapter có bình luận
   * @route GET /api/admin/comments/chapters
   */
  async getChaptersWithComments(req, res) {
    try {
      const {
        page = 1,
        limit = 100,
        search = '',
        sort = 'totalComments',
        direction = 'desc',
        status = 'all',
        moderationStatus = 'all',
        minComments = '',
        maxComments = '',
        dateFrom,
        dateTo,
        story_id = ''
      } = req.query;

      console.log('🔍 [getChaptersWithComments] Request params:', {
        page, limit, search, sort, direction, status, moderationStatus,
        minComments, maxComments, dateFrom, dateTo, story_id
      });

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skipNumber = (pageNumber - 1) * limitNumber;

      // Get collection names from Mongoose models
      const Comment = require('../../models/comment');
      const Chapter = require('../../models/chapter');
      const Story = require('../../models/story');
      const mongoose = require('mongoose');

      const commentCollectionName = Comment.collection.name;
      const chapterCollectionName = Chapter.collection.name;
      const storyCollectionName = Story.collection.name;

      console.log('📋 [getChaptersWithComments] Model collection names:');
      console.log('  - Comment collection:', commentCollectionName);
      console.log('  - Chapter collection:', chapterCollectionName);
      console.log('  - Story collection:', storyCollectionName);

      // Build match stage for comments
      const matchStage = {
        'target.type': 'chapter'
      };

      // Add moderation status filter
      if (moderationStatus !== 'all') {
        matchStage['moderation.status'] = moderationStatus;
      }

      // Add date range filter
      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) {
          matchStage.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          matchStage.createdAt.$lte = new Date(dateTo);
        }
      }

      console.log('🔍 [getChaptersWithComments] Match stage:', JSON.stringify(matchStage, null, 2));

      // Build the aggregation pipeline
      const pipeline = [
        // Match comments based on filters
        { $match: matchStage },

        // Group by chapter to get comment counts
        {
          $group: {
            _id: '$target.chapter_id',
            totalComments: { $sum: 1 },
            activeComments: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.status', 'active'] },
                  1,
                  0
                ]
              }
            },
            pendingComments: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.status', 'pending'] },
                  1,
                  0
                ]
              }
            },
            flaggedComments: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$moderation.flags.count', 0] },
                      { $gt: [{ $ifNull: ['$moderation.flags.count', 0] }, 0] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            lastCommentDate: { $max: '$createdAt' }
          }
        }
      ];

      // Add comment count filters
      if (minComments || maxComments) {
        const commentCountFilter = {};
        if (minComments) {
          commentCountFilter.$gte = parseInt(minComments);
        }
        if (maxComments) {
          commentCountFilter.$lte = parseInt(maxComments);
        }
        pipeline.push({ $match: { totalComments: commentCountFilter } });
      }

      // Add lookup stages
      pipeline.push(
        // Lookup chapter details
        {
          $lookup: {
            from: chapterCollectionName,
            localField: '_id',
            foreignField: '_id',
            as: 'chapter'
          }
        },

        // Filter out chapters that don't exist
        { $match: { 'chapter.0': { $exists: true } } },

        // Unwind chapter
        { $unwind: '$chapter' },

        // Lookup story details
        {
          $lookup: {
            from: storyCollectionName,
            localField: 'chapter.story_id',
            foreignField: '_id',
            as: 'story'
          }
        },

        // Unwind story with preserveNullAndEmptyArrays
        { $unwind: { path: '$story', preserveNullAndEmptyArrays: true } }
      );

      // Add search filter
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { 'chapter.name': { $regex: search, $options: 'i' } },
              { 'story.name': { $regex: search, $options: 'i' } }
            ]
          }
        });
      }

      // Add story filter
      if (story_id) {
        pipeline.push({
          $match: {
            'chapter.story_id': new mongoose.Types.ObjectId(story_id)
          }
        });
      }

      // Add project stage
      pipeline.push({
        $project: {
          _id: '$chapter._id',
          name: { $ifNull: ['$chapter.name', 'Unknown Chapter'] },
          slug: { $ifNull: ['$chapter.slug', 'unknown-chapter'] },
          chapter: { $ifNull: ['$chapter.chapter', 0] },
          story_id: '$chapter.story_id',
          story: {
            _id: { $ifNull: ['$story._id', null] },
            name: { $ifNull: ['$story.name', 'Unknown Story'] },
            slug: { $ifNull: ['$story.slug', 'unknown-story'] }
          },
          totalComments: 1,
          activeComments: 1,
          pendingComments: 1,
          flaggedComments: 1,
          lastCommentDate: 1,
          moderationStatus: {
            $cond: [
              { $gt: ['$flaggedComments', 5] }, 'flagged',
              { $cond: [
                { $gt: ['$pendingComments', 0] }, 'needs_review',
                'clean'
              ]}
            ]
          },
          createdAt: '$chapter.createdAt',
          updatedAt: '$chapter.updatedAt'
        }
      });

      // Add sorting
      const sortStage = {};
      if (sort === 'totalComments') {
        sortStage.totalComments = direction === 'asc' ? 1 : -1;
      } else if (sort === 'name') {
        sortStage.name = direction === 'asc' ? 1 : -1;
      } else if (sort === 'chapter') {
        sortStage.chapter = direction === 'asc' ? 1 : -1;
      } else if (sort === 'lastCommentDate') {
        sortStage.lastCommentDate = direction === 'asc' ? 1 : -1;
      } else {
        sortStage.totalComments = -1; // Default sort
      }
      pipeline.push({ $sort: sortStage });

      // Get total count for pagination
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await Comment.aggregate(countPipeline);
      const totalItems = countResult[0]?.total || 0;

      // Add pagination
      pipeline.push(
        { $skip: skipNumber },
        { $limit: limitNumber }
      );

      console.log('🚀 [getChaptersWithComments] Executing aggregation pipeline...');
      const chapters = await Comment.aggregate(pipeline);

      console.log(`✅ [getChaptersWithComments] Found ${chapters.length} chapters with comments`);

      // Calculate pagination info
      const totalPages = Math.ceil(totalItems / limitNumber);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      const response = {
        success: true,
        data: chapters,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          itemsPerPage: limitNumber,
          hasNextPage,
          hasPrevPage
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error getting chapters with comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách chapter có bình luận'
      });
    }
  }

  /**
   * Lấy danh sách user có bình luận
   * @route GET /api/admin/comments/users
   */
  async getUsersWithComments(req, res) {
    try {
      const {
        page = 1,
        limit = 100,
        search = '',
        sort = 'totalComments',
        direction = 'desc',
        status = 'all',
        moderationStatus = 'all',
        minComments = '',
        maxComments = '',
        dateFrom,
        dateTo,
        role = 'all',
        accountType = 'all'
      } = req.query;

      console.log('🔍 [getUsersWithComments] Request params:', {
        page, limit, search, sort, direction, status, moderationStatus,
        minComments, maxComments, dateFrom, dateTo, role, accountType
      });

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skipNumber = (pageNumber - 1) * limitNumber;

      // Get collection names from Mongoose models
      const Comment = require('../../models/comment');
      const User = require('../../models/user');
      const mongoose = require('mongoose');

      const commentCollectionName = Comment.collection.name;
      const userCollectionName = User.collection.name;

      console.log('📋 [getUsersWithComments] Model collection names:');
      console.log('  - Comment collection:', commentCollectionName);
      console.log('  - User collection:', userCollectionName);

      // Build match stage for comments
      const matchStage = {};

      // Add moderation status filter
      if (moderationStatus !== 'all') {
        matchStage['moderation.status'] = moderationStatus;
      }

      // Add date range filter
      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) {
          matchStage.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          matchStage.createdAt.$lte = new Date(dateTo);
        }
      }

      console.log('🔍 [getUsersWithComments] Match stage:', JSON.stringify(matchStage, null, 2));

      // Build the aggregation pipeline
      const pipeline = [
        // Match comments based on filters
        { $match: matchStage },

        // Group by user to get comment counts
        {
          $group: {
            _id: '$user_id',
            totalComments: { $sum: 1 },
            activeComments: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.status', 'active'] },
                  1,
                  0
                ]
              }
            },
            pendingComments: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.status', 'pending'] },
                  1,
                  0
                ]
              }
            },
            flaggedComments: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$moderation.flags.count', 0] },
                      { $gt: [{ $ifNull: ['$moderation.flags.count', 0] }, 0] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            lastCommentDate: { $max: '$createdAt' }
          }
        }
      ];

      // Add comment count filters
      if (minComments || maxComments) {
        const commentCountFilter = {};
        if (minComments) {
          commentCountFilter.$gte = parseInt(minComments);
        }
        if (maxComments) {
          commentCountFilter.$lte = parseInt(maxComments);
        }
        pipeline.push({ $match: { totalComments: commentCountFilter } });
      }

      // Add lookup stages
      pipeline.push(
        // Lookup user details
        {
          $lookup: {
            from: userCollectionName,
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },

        // Filter out users that don't exist
        { $match: { 'user.0': { $exists: true } } },

        // Unwind user
        { $unwind: '$user' }
      );

      // Add user filters
      const userFilters = {};

      // Add role filter
      if (role !== 'all') {
        userFilters['user.role'] = role;
      }

      // Add account type filter
      if (accountType !== 'all') {
        userFilters['user.accountType'] = accountType;
      }

      // Add status filter
      if (status !== 'all') {
        userFilters['user.status'] = status;
      }

      // Add search filter
      if (search) {
        userFilters.$or = [
          { 'user.name': { $regex: search, $options: 'i' } },
          { 'user.email': { $regex: search, $options: 'i' } }
        ];
      }

      if (Object.keys(userFilters).length > 0) {
        pipeline.push({ $match: userFilters });
      }

      // Add project stage
      pipeline.push({
        $project: {
          _id: '$user._id',
          name: { $ifNull: ['$user.name', 'Unknown User'] },
          slug: { $ifNull: ['$user.slug', 'unknown-user'] },
          email: { $ifNull: ['$user.email', 'unknown@email.com'] },
          'avatar.primaryUrl': { $ifNull: ['$user.avatar.primaryUrl', ''] },
          role: { $ifNull: ['$user.role', 'user'] },
          accountType: { $ifNull: ['$user.accountType', 'email'] },
          coin: { $ifNull: ['$user.coin', 0] },
          createdAt: '$user.createdAt',
          totalComments: 1,
          activeComments: 1,
          pendingComments: 1,
          flaggedComments: 1,
          lastCommentDate: 1,
          moderationStatus: {
            $cond: [
              { $gt: ['$flaggedComments', 5] }, 'flagged',
              { $cond: [
                { $gt: ['$pendingComments', 0] }, 'needs_review',
                'clean'
              ]}
            ]
          }
        }
      });

      // Add sorting
      const sortStage = {};
      if (sort === 'totalComments') {
        sortStage.totalComments = direction === 'asc' ? 1 : -1;
      } else if (sort === 'name') {
        sortStage.name = direction === 'asc' ? 1 : -1;
      } else if (sort === 'email') {
        sortStage.email = direction === 'asc' ? 1 : -1;
      } else if (sort === 'role') {
        sortStage.role = direction === 'asc' ? 1 : -1;
      } else if (sort === 'coin') {
        sortStage.coin = direction === 'asc' ? 1 : -1;
      } else if (sort === 'lastCommentDate') {
        sortStage.lastCommentDate = direction === 'asc' ? 1 : -1;
      } else if (sort === 'createdAt') {
        sortStage.createdAt = direction === 'asc' ? 1 : -1;
      } else {
        sortStage.totalComments = -1; // Default sort
      }
      pipeline.push({ $sort: sortStage });

      // Get total count for pagination
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await Comment.aggregate(countPipeline);
      const totalItems = countResult[0]?.total || 0;

      // Add pagination
      pipeline.push(
        { $skip: skipNumber },
        { $limit: limitNumber }
      );

      console.log('🚀 [getUsersWithComments] Executing aggregation pipeline...');
      const users = await Comment.aggregate(pipeline);

      console.log(`✅ [getUsersWithComments] Found ${users.length} users with comments`);

      // Calculate pagination info
      const totalPages = Math.ceil(totalItems / limitNumber);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      const response = {
        success: true,
        data: users,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          itemsPerPage: limitNumber,
          hasNextPage,
          hasPrevPage
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error getting users with comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách user có bình luận'
      });
    }
  }

  /**
   * Lấy comments theo story ID
   * @route GET /api/admin/comments/story/:storyId
   */
  async getCommentsByStory(req, res) {
    try {
      const { storyId } = req.params;
      const {
        page = 1,
        limit = 20,
        search = '',
        sort = 'createdAt',
        direction = 'desc',
        status = 'all',
        dateFrom,
        dateTo,
        userId
      } = req.query;

      console.log('🔍 [getCommentsByStory] Request params:', {
        storyId, page, limit, search, sort, direction, status, dateFrom, dateTo, userId
      });

      // Validate storyId
      if (!storyId || !storyId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'ID truyện không hợp lệ'
        });
      }

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skipNumber = (pageNumber - 1) * limitNumber;

      // Build match conditions
      const matchConditions = {
        story_id: new mongoose.Types.ObjectId(storyId),
        type: 'story'
      };

      // Add status filter
      if (status !== 'all') {
        matchConditions.status = status;
      }

      // Add search filter
      if (search) {
        matchConditions.$or = [
          { 'content.original': { $regex: search, $options: 'i' } },
          { 'content.processed': { $regex: search, $options: 'i' } }
        ];
      }

      // Add date range filter
      if (dateFrom || dateTo) {
        matchConditions.createdAt = {};
        if (dateFrom) {
          matchConditions.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          matchConditions.createdAt.$lte = new Date(dateTo);
        }
      }

      // Add user filter
      if (userId) {
        matchConditions.user_id = new mongoose.Types.ObjectId(userId);
      }

      // Build aggregation pipeline
      const pipeline = [
        { $match: matchConditions },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $addFields: {
            user: { $arrayElemAt: ['$user', 0] },
            story: { $arrayElemAt: ['$story', 0] }
          }
        }
      ];

      // Add sorting
      const sortStage = {};
      if (sort === 'createdAt') {
        sortStage.createdAt = direction === 'asc' ? 1 : -1;
      } else if (sort === 'engagement.score') {
        sortStage['engagement.score'] = direction === 'asc' ? 1 : -1;
      }
      pipeline.push({ $sort: sortStage });

      // Get total count
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await Comment.aggregate(countPipeline);
      const totalItems = countResult[0]?.total || 0;

      // Add pagination
      pipeline.push(
        { $skip: skipNumber },
        { $limit: limitNumber }
      );

      const comments = await Comment.aggregate(pipeline);

      // Calculate pagination
      const totalPages = Math.ceil(totalItems / limitNumber);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      // Get story metadata
      const Story = require('../../models/story');
      const story = await Story.findById(storyId)
        .select('name slug image author')
        .populate('author', 'name slug')
        .lean();

      const response = {
        success: true,
        data: comments,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          itemsPerPage: limitNumber,
          hasNextPage,
          hasPrevPage
        },
        meta: {
          story
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error getting comments by story:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy bình luận theo truyện'
      });
    }
  }

  /**
   * Lấy comments theo chapter ID
   * @route GET /api/admin/comments/chapter/:chapterId
   */
  async getCommentsByChapter(req, res) {
    try {
      const { chapterId } = req.params;
      const {
        page = 1,
        limit = 20,
        search = '',
        sort = 'createdAt',
        direction = 'desc',
        status = 'all',
        dateFrom,
        dateTo,
        userId
      } = req.query;

      console.log('🔍 [getCommentsByChapter] Request params:', {
        chapterId, page, limit, search, sort, direction, status, dateFrom, dateTo, userId
      });

      // Validate chapterId
      if (!chapterId || !chapterId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'ID chương không hợp lệ'
        });
      }

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skipNumber = (pageNumber - 1) * limitNumber;

      // Build match conditions
      const matchConditions = {
        chapter_id: new mongoose.Types.ObjectId(chapterId),
        type: 'chapter'
      };

      // Add status filter
      if (status !== 'all') {
        matchConditions.status = status;
      }

      // Add search filter
      if (search) {
        matchConditions.$or = [
          { 'content.original': { $regex: search, $options: 'i' } },
          { 'content.processed': { $regex: search, $options: 'i' } }
        ];
      }

      // Add date range filter
      if (dateFrom || dateTo) {
        matchConditions.createdAt = {};
        if (dateFrom) {
          matchConditions.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          matchConditions.createdAt.$lte = new Date(dateTo);
        }
      }

      // Add user filter
      if (userId) {
        matchConditions.user_id = new mongoose.Types.ObjectId(userId);
      }

      // Build aggregation pipeline
      const pipeline = [
        { $match: matchConditions },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'chapters',
            localField: 'chapter_id',
            foreignField: '_id',
            as: 'chapter'
          }
        },
        {
          $addFields: {
            user: { $arrayElemAt: ['$user', 0] },
            chapter: { $arrayElemAt: ['$chapter', 0] }
          }
        },
        {
          $lookup: {
            from: 'stories',
            localField: 'chapter.story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $addFields: {
            story: { $arrayElemAt: ['$story', 0] }
          }
        }
      ];

      // Add sorting
      const sortStage = {};
      if (sort === 'createdAt') {
        sortStage.createdAt = direction === 'asc' ? 1 : -1;
      } else if (sort === 'engagement.score') {
        sortStage['engagement.score'] = direction === 'asc' ? 1 : -1;
      }
      pipeline.push({ $sort: sortStage });

      // Get total count
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await Comment.aggregate(countPipeline);
      const totalItems = countResult[0]?.total || 0;

      // Add pagination
      pipeline.push(
        { $skip: skipNumber },
        { $limit: limitNumber }
      );

      const comments = await Comment.aggregate(pipeline);

      // Calculate pagination
      const totalPages = Math.ceil(totalItems / limitNumber);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      // Get chapter metadata
      const Chapter = require('../../models/chapter');
      const chapter = await Chapter.findById(chapterId)
        .select('name chapter story_id')
        .populate({
          path: 'story_id',
          select: 'name slug image author',
          populate: {
            path: 'author',
            select: 'name slug'
          }
        })
        .lean();

      const response = {
        success: true,
        data: comments,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          itemsPerPage: limitNumber,
          hasNextPage,
          hasPrevPage
        },
        meta: {
          chapter,
          story: chapter?.story_id
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error getting comments by chapter:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy bình luận theo chương'
      });
    }
  }

  /**
   * Lấy comments theo user ID
   * @route GET /api/admin/comments/user/:userId
   */
  async getCommentsByUser(req, res) {
    try {
      const { userId } = req.params;
      const {
        page = 1,
        limit = 20,
        search = '',
        sort = 'createdAt',
        direction = 'desc',
        status = 'all',
        dateFrom,
        dateTo,
        type = 'all'
      } = req.query;

      console.log('🔍 [getCommentsByUser] Request params:', {
        userId, page, limit, search, sort, direction, status, dateFrom, dateTo, type
      });

      // Validate userId
      if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'ID người dùng không hợp lệ'
        });
      }

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skipNumber = (pageNumber - 1) * limitNumber;

      const Comment = require('../../models/comment');

      // Build match conditions
      const matchConditions = {
        user_id: new mongoose.Types.ObjectId(userId)
      };

      // Add status filter
      if (status !== 'all') {
        matchConditions.status = status;
      }

      // Add type filter
      if (type !== 'all') {
        matchConditions.type = type;
      }

      // Add search filter
      if (search) {
        matchConditions.$or = [
          { 'content.original': { $regex: search, $options: 'i' } },
          { 'content.processed': { $regex: search, $options: 'i' } }
        ];
      }

      // Add date range filter
      if (dateFrom || dateTo) {
        matchConditions.createdAt = {};
        if (dateFrom) {
          matchConditions.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          matchConditions.createdAt.$lte = new Date(dateTo);
        }
      }

      // Build aggregation pipeline
      const pipeline = [
        { $match: matchConditions },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user_id'
          }
        },
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $lookup: {
            from: 'chapters',
            localField: 'chapter_id',
            foreignField: '_id',
            as: 'chapter'
          }
        },
        {
          $addFields: {
            user_id: { $arrayElemAt: ['$user_id', 0] },
            story: { $arrayElemAt: ['$story', 0] },
            chapter: { $arrayElemAt: ['$chapter', 0] }
          }
        }
      ];

      // Add sorting
      const sortStage = {};
      if (sort === 'createdAt') {
        sortStage.createdAt = direction === 'asc' ? 1 : -1;
      } else if (sort === 'engagement.score') {
        sortStage['engagement.score'] = direction === 'asc' ? 1 : -1;
      }
      pipeline.push({ $sort: sortStage });

      // Get total count
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await Comment.aggregate(countPipeline);
      const totalItems = countResult[0]?.total || 0;

      // Add pagination
      pipeline.push(
        { $skip: skipNumber },
        { $limit: limitNumber }
      );

      const comments = await Comment.aggregate(pipeline);

      // Calculate pagination
      const totalPages = Math.ceil(totalItems / limitNumber);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      // Get user metadata
      const User = require('../../models/user');
      const user = await User.findById(userId)
        .select('name slug email avatar role accountType coin createdAt')
        .lean();

      const response = {
        success: true,
        data: comments,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          itemsPerPage: limitNumber,
          hasNextPage,
          hasPrevPage
        },
        meta: {
          user
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error getting comments by user:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy bình luận theo người dùng'
      });
    }
  }

  /**
   * Lấy activity overview của user (stories và chapters đã comment)
   * @route GET /api/admin/comments/user/:userId/activity
   */
  async getUserCommentActivity(req, res) {
    try {
      const { userId } = req.params;
      const {
        page = 1,
        limit = 20,
        search = '',
        type = 'all', // 'all', 'stories', 'chapters'
        sort = 'lastActivity',
        direction = 'desc'
      } = req.query;

      console.log('🔍 [getUserCommentActivity] Request params:', {
        userId, page, limit, search, type, sort, direction
      });

      // Validate userId
      if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'ID người dùng không hợp lệ'
        });
      }

      const Comment = require('../../models/comment');
      const User = require('../../models/user');

      // Get user info
      const user = await User.findById(userId)
        .select('name slug email avatar role accountType coin createdAt')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Build aggregation pipeline for stories
      const storiesAggregation = [
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(userId),
            'target.type': 'story',
            'target.story_id': { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$target.story_id',
            commentCount: { $sum: 1 },
            lastCommentDate: { $max: '$createdAt' },
            firstCommentDate: { $min: '$createdAt' }
          }
        },
        {
          $lookup: {
            from: 'stories',
            localField: '_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $unwind: '$story'
        },
        {
          $project: {
            _id: '$story._id',
            name: '$story.name',
            slug: '$story.slug',
            cover: '$story.cover',
            commentCount: 1,
            lastCommentDate: 1,
            firstCommentDate: 1
          }
        }
      ];

      // Add search filter for stories
      if (search && (type === 'all' || type === 'stories')) {
        storiesAggregation.splice(-1, 0, {
          $match: {
            'story.name': { $regex: search, $options: 'i' }
          }
        });
      }

      // Build aggregation pipeline for chapters
      const chaptersAggregation = [
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(userId),
            'target.type': 'chapter',
            'target.chapter_id': { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$target.chapter_id',
            commentCount: { $sum: 1 },
            lastCommentDate: { $max: '$createdAt' },
            firstCommentDate: { $min: '$createdAt' }
          }
        },
        {
          $lookup: {
            from: 'chapters',
            localField: '_id',
            foreignField: '_id',
            as: 'chapter'
          }
        },
        {
          $unwind: '$chapter'
        },
        {
          $lookup: {
            from: 'stories',
            localField: 'chapter.story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $unwind: '$story'
        },
        {
          $project: {
            _id: '$chapter._id',
            name: '$chapter.name',
            chapter: '$chapter.chapter',
            story_id: {
              _id: '$story._id',
              name: '$story.name',
              slug: '$story.slug'
            },
            commentCount: 1,
            lastCommentDate: 1,
            firstCommentDate: 1
          }
        }
      ];

      // Add search filter for chapters
      if (search && (type === 'all' || type === 'chapters')) {
        chaptersAggregation.splice(-2, 0, {
          $match: {
            $or: [
              { 'chapter.name': { $regex: search, $options: 'i' } },
              { 'story.name': { $regex: search, $options: 'i' } }
            ]
          }
        });
      }

      // Execute aggregations based on type filter
      let stories = [];
      let chapters = [];

      if (type === 'all' || type === 'stories') {
        stories = await Comment.aggregate(storiesAggregation);
      }

      if (type === 'all' || type === 'chapters') {
        chapters = await Comment.aggregate(chaptersAggregation);
      }

      // Sort results
      const sortField = sort === 'lastActivity' ? 'lastCommentDate' :
                       sort === 'commentCount' ? 'commentCount' : 'name';
      const sortDirection = direction === 'asc' ? 1 : -1;

      if (stories.length > 0) {
        stories.sort((a, b) => {
          if (sortField === 'name') {
            return sortDirection * a[sortField].localeCompare(b[sortField]);
          }
          return sortDirection * (new Date(b[sortField]) - new Date(a[sortField]));
        });
      }

      if (chapters.length > 0) {
        chapters.sort((a, b) => {
          if (sortField === 'name') {
            return sortDirection * a[sortField].localeCompare(b[sortField]);
          }
          return sortDirection * (new Date(b[sortField]) - new Date(a[sortField]));
        });
      }

      // Get total comment count
      const totalCommentsResult = await Comment.aggregate([
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(userId)
          }
        },
        {
          $count: 'total'
        }
      ]);

      const totalComments = totalCommentsResult[0]?.total || 0;

      const response = {
        success: true,
        data: {
          stories,
          chapters
        },
        meta: {
          user,
          totalStories: stories.length,
          totalChapters: chapters.length,
          totalComments
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error getting user comment activity:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy hoạt động bình luận của người dùng'
      });
    }
  }


}

module.exports = new ModerationController();
