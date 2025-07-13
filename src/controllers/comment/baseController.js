const commentService = require('../../services/comment/commentService');
const cacheService = require('../../services/comment/cacheService');

/**
 * Base controller cho comment operations
 */
class BaseCommentController {

  /**
   * Lấy danh sách comments
   * @route GET /api/comments
   */
  async getComments(req, res) {
    try {
      // FIXED: Handle null prototype req.query by checking both req.params and req.query
      // req.params takes precedence for chapter_id and story_id (set by route middleware)
      const story_id = req.params['story_id'] || req.query['story_id'];
      const chapter_id = req.params['chapter_id'] || req.query['chapter_id'];
      const parent_id = req.query['parent_id'];
      const page = req.query['page'] || 1;
      const limit = req.query['limit'] || 10;
      const sort = req.query['sort'] || 'newest';
      const include_replies = req.query['include_replies'] || true;

      const options = {
        story_id,
        chapter_id,
        parent_id,
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        include_replies: include_replies === 'true',
        user_id: req.user?._id || req.user?.id,
        user_role: req.user?.role
      };

      // CRITICAL FIX: Disable caching for authenticated users to ensure real-time userReaction updates
      // For authenticated users, always fetch fresh data to get correct userReaction status
      const cachedResult = !options.user_id ? cacheService.getCachedComments(options) : null;
      if (cachedResult) {
        // Get story metadata for cached results too
        let meta = null;
        if (story_id) {
          try {
            const Story = require('../../models/story');
            const story = await Story.findById(story_id)
              .select('name slug image')
              .lean();

            if (story) {
              // Get comment stats for this story
              const Comment = require('../../models/comment');
              const [totalComments, activeComments, hiddenComments, deletedComments] = await Promise.all([
                Comment.countDocuments({ 'target.story_id': story_id }),
                Comment.countDocuments({ 'target.story_id': story_id, 'moderation.status': 'active' }),
                Comment.countDocuments({ 'target.story_id': story_id, 'moderation.status': 'hidden' }),
                Comment.countDocuments({ 'target.story_id': story_id, 'moderation.status': 'deleted' })
              ]);

              meta = {
                story: {
                  _id: story._id,
                  name: story.name,
                  slug: story.slug,
                  image: story.image
                },
                totalComments,
                activeComments,
                hiddenComments,
                deletedComments
              };
            }
          } catch (storyError) {
            console.error('Error fetching story metadata for cached result:', storyError);
            // Continue without meta data
          }
        }

        return res.json({
          success: true,
          data: cachedResult.comments,
          pagination: cachedResult.pagination,
          meta,
          cached: true
        });
      }

      // Get from service
      const result = await commentService.getComments(options);

      // Get story metadata if story_id is provided
      let meta = null;
      if (story_id) {
        try {
          const Story = require('../../models/story');
          const story = await Story.findById(story_id)
            .select('name slug image')
            .lean();

          if (story) {
            // Get comment stats for this story
            const Comment = require('../../models/comment');
            const [totalComments, activeComments, hiddenComments, deletedComments] = await Promise.all([
              Comment.countDocuments({ 'target.story_id': story_id }),
              Comment.countDocuments({ 'target.story_id': story_id, 'moderation.status': 'active' }),
              Comment.countDocuments({ 'target.story_id': story_id, 'moderation.status': 'hidden' }),
              Comment.countDocuments({ 'target.story_id': story_id, 'moderation.status': 'deleted' })
            ]);

            meta = {
              story: {
                _id: story._id,
                name: story.name,
                slug: story.slug,
                image: story.image
              },
              totalComments,
              activeComments,
              hiddenComments,
              deletedComments
            };
          }
        } catch (storyError) {
          console.error('Error fetching story metadata:', storyError);
          // Continue without meta data
        }
      }

      // CRITICAL FIX: Only cache results for non-authenticated users
      // Authenticated users need fresh data for correct userReaction status
      if (!options.user_id) {
        cacheService.cacheComments(options, result, 300); // 5 minutes
      }

      res.json({
        success: true,
        data: result.comments,
        pagination: result.pagination,
        meta,
        cached: false
      });
    } catch (error) {
      console.error('Error getting comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách bình luận'
      });
    }
  }

  /**
   * Tạo comment mới
   * @route POST /api/comments
   */
  async createComment(req, res) {
    try {
      let userId = req.user._id || req.user.id;

      // Alternative approach: If middleware failed to extract user_id, try to get from session/token manually
      if (!userId) {
        console.warn('[Comment Controller] No user ID in req.user, trying alternative approach...');

        // Try to decode token manually
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id || decoded._id;
          } catch (tokenError) {
            console.error('[Comment Controller] Manual token decode failed:', tokenError.message);
          }
        }
      }

      if (!userId) {
        console.error('[Comment Controller] No user ID found after all attempts');
        return res.status(401).json({
          success: false,
          message: 'User ID not found in authentication token'
        });
      }

      const commentData = req.body;

      // Get metadata from request
      const metadata = {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await commentService.createComment(userId, commentData, metadata);

      // Invalidate cache
      cacheService.invalidateOnNewComment(result.data);

      // Prepare response with mission progress information
      const response = {
        success: result.success,
        message: result.message,
        data: result.data,
        quote_info: result.quote_info
      };

      // Add mission progress information if available
      if (result.missionProgress && result.missionProgress.length > 0) {
        response.missionProgress = result.missionProgress;

        // Add summary of mission updates
        const completedMissions = result.missionProgress.filter(m => m.newly_completed);
        if (completedMissions.length > 0) {
          response.message += ` | ${completedMissions.length} nhiệm vụ đã hoàn thành!`;
        }

        console.log('[Comment API] Mission progress included in response:', {
          userId,
          commentId: result.data._id,
          totalMissionUpdates: result.missionProgress.length,
          newlyCompletedMissions: completedMissions.length
        });
      }

      res.status(201).json(response);
    } catch (error) {
      console.error('[Comment Controller] Error creating comment:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi tạo bình luận'
      });
    }
  }

  /**
   * Cập nhật comment
   * @route PUT /api/comments/:id
   */
  async updateComment(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id || req.user.id;
      const updateData = req.body;

      const result = await commentService.updateComment(id, userId, updateData);

      // Invalidate cache
      cacheService.invalidateOnCommentUpdate(result.data);

      res.json(result);
    } catch (error) {
      console.error('Error updating comment:', error);

      if (error.message.includes('không tồn tại')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('không có quyền') || error.message.includes('quá thời hạn')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi cập nhật bình luận'
      });
    }
  }

  /**
   * Xóa comment
   * @route DELETE /api/comments/:id
   */
  async deleteComment(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id || req.user.id;
      const userRole = req.user.role;
      const { reason } = req.body || {}; // Make reason optional

      // Get comment data before deletion for cache invalidation
      const Comment = require('../../models/comment');
      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Bình luận không tồn tại'
        });
      }

      // Store target info for cache invalidation
      const storyId = comment.target.story_id;
      const chapterId = comment.target.chapter_id;

      const result = await commentService.deleteComment(id, userId, reason, userRole);

      // Invalidate cache using the comment's target information
      if (storyId) {
        cacheService.invalidateStoryCache(storyId);
      }
      if (chapterId) {
        cacheService.invalidateChapterCache(chapterId);
      }

      res.json(result);
    } catch (error) {
      console.error('Error deleting comment:', error);

      if (error.message.includes('không tồn tại')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('không có quyền')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi xóa bình luận'
      });
    }
  }

  /**
   * Like/Dislike/Remove reaction
   * @route POST /api/comments/:id/reaction
   */
  async toggleReaction(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id || req.user.id;
      const { action } = req.body;

      const result = await commentService.toggleReaction(id, userId, action);

      // CRITICAL FIX: Invalidate ALL related caches for real-time updates
      // Get the comment to find its story_id and chapter_id for proper cache invalidation
      const Comment = require('../../models/comment');
      const comment = await Comment.findById(id).select('target hierarchy').lean();

      if (comment) {
        // Invalidate thread cache for the specific comment
        cacheService.invalidateThreadCache(id);

        // CRITICAL: Invalidate story/chapter comment list caches
        if (comment.target.story_id) {
          cacheService.invalidateStoryCache(comment.target.story_id);
        }
        if (comment.target.chapter_id) {
          cacheService.invalidateChapterCache(comment.target.chapter_id);
        }

        // If this is a reply, also invalidate the root comment thread
        if (comment.hierarchy.root_id) {
          cacheService.invalidateThreadCache(comment.hierarchy.root_id);
        }
      } else {
        // Fallback: just invalidate the thread cache
        cacheService.invalidateThreadCache(id);
      }

      // Check if the operation was successful
      if (result.success === false) {
        // Return error response for failed operations (like duplicate likes)
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Error toggling reaction:', error);

      if (error.message.includes('không tồn tại')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi thực hiện reaction'
      });
    }
  }

  /**
   * Flag comment
   * @route POST /api/comments/:id/flag
   */
  async flagComment(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id || req.user.id;
      const { reason, description } = req.body;

      const result = await commentService.flagComment(id, userId, reason, description);

      res.json(result);
    } catch (error) {
      console.error('Error flagging comment:', error);

      if (error.message.includes('không tồn tại')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('không thể báo cáo')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi báo cáo bình luận'
      });
    }
  }

  /**
   * Lấy comment thread
   * @route GET /api/comments/:id/thread
   */
  async getCommentThread(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?._id || req.user?.id;
      const userRole = req.user?.role;

      // Check cache first (only for non-authenticated requests to avoid userReaction issues)
      const cachedThread = !userId ? cacheService.getCachedThread(id) : null;
      if (cachedThread) {
        return res.json({
          success: true,
          data: cachedThread,
          cached: true
        });
      }

      const result = await commentService.getCommentThread(id, userId, userRole);

      // Cache thread
      cacheService.cacheThread(id, result.data, 600); // 10 minutes

      res.json({
        ...result,
        cached: false
      });
    } catch (error) {
      console.error('Error getting comment thread:', error);

      if (error.message.includes('không tồn tại')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy chuỗi bình luận'
      });
    }
  }

  /**
   * Search comments
   * @route GET /api/comments/search
   */
  async searchComments(req, res) {
    try {
      const {
        q: query,
        story_id,
        chapter_id,
        user_id,
        limit = 20,
        skip = 0
      } = req.query;

      const searchOptions = {
        query,
        story_id,
        chapter_id,
        user_id,
        limit: parseInt(limit),
        skip: parseInt(skip),
        current_user_id: req.user?._id || req.user?.id,
        current_user_role: req.user?.role
      };

      const result = await commentService.searchComments(searchOptions);

      res.json(result);
    } catch (error) {
      console.error('Error searching comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi tìm kiếm bình luận'
      });
    }
  }

  /**
   * Lấy thống kê comments
   * @route GET /api/comments/stats
   */
  async getCommentStats(req, res) {
    try {
      const {
        story_id,
        chapter_id,
        timeRange = '7d'
      } = req.query;

      const options = {
        story_id,
        chapter_id,
        timeRange
      };

      // Check cache first
      const cachedStats = cacheService.getCachedStats(options);
      if (cachedStats) {
        return res.json({
          success: true,
          data: cachedStats,
          cached: true
        });
      }

      const result = await commentService.getCommentStats(options);

      // Cache stats
      cacheService.cacheStats(options, result.data, 900); // 15 minutes

      res.json({
        ...result,
        cached: false
      });
    } catch (error) {
      console.error('Error getting comment stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy thống kê bình luận'
      });
    }
  }

  /**
   * Lấy hot comments (trending/popular)
   * @route GET /api/comments/hot
   */
  async getHotComments(req, res) {
    try {
      const {
        type = 'popular', // 'popular' hoặc 'trending'
        limit = 10,
        timeRange = '24h'
      } = req.query;

      // Check cache first
      const cachedHotComments = cacheService.getCachedHotComments(type);
      if (cachedHotComments) {
        return res.json({
          success: true,
          data: cachedHotComments,
          cached: true
        });
      }

      // Build query based on type
      let sortCriteria = {};
      let timeFilter = {};

      if (type === 'trending') {
        // Trending: high engagement in short time
        const hours = timeRange === '24h' ? 24 : 168; // 24h or 7d
        timeFilter.createdAt = {
          $gte: new Date(Date.now() - hours * 60 * 60 * 1000)
        };
        sortCriteria = { 'engagement.score': -1, createdAt: -1 };
      } else {
        // Popular: all-time high engagement
        sortCriteria = { 'engagement.score': -1, 'engagement.likes.count': -1 };
      }

      const Comment = require('../../models/comment');
      const hotComments = await Comment.find({
        'moderation.status': 'active',
        'engagement.score': { $gte: 5 }, // Minimum engagement score
        ...timeFilter
      })
        .sort(sortCriteria)
        .limit(parseInt(limit))
        .populate('user_id', 'name avatar slug level')
        .populate('target.story_id', 'title slug cover_image')
        .populate('target.chapter_id', 'title chapter_number')
        .lean();

      // Cache result
      cacheService.cacheHotComments(type, hotComments, 1800); // 30 minutes

      res.json({
        success: true,
        data: hotComments,
        cached: false
      });
    } catch (error) {
      console.error('Error getting hot comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy bình luận hot'
      });
    }
  }

  /**
   * Lấy thông tin parent comment cho persistent reply form
   * @route GET /api/comments/:commentId/parent-info
   */
  async getParentCommentInfo(req, res) {
    try {
      const { commentId } = req.params;
      const result = await commentService.getParentCommentInfo(commentId);

      res.json(result);
    } catch (error) {
      console.error('Error getting parent comment info:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Có lỗi xảy ra khi lấy thông tin parent comment'
      });
    }
  }
}

module.exports = new BaseCommentController();
