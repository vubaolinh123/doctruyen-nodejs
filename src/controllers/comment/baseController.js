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
      const {
        story_id,
        chapter_id,
        parent_id,
        cursor,
        limit = 20,
        sort = 'newest',
        include_replies = false
      } = req.query;

      const options = {
        story_id,
        chapter_id,
        parent_id,
        cursor,
        limit: parseInt(limit),
        sort,
        include_replies: include_replies === 'true',
        user_id: req.user?._id || req.user?.id
      };

      // Debug logging for user authentication
      console.log('[Comment Controller] getComments Debug:', {
        hasUser: !!req.user,
        userId: options.user_id,
        userKeys: req.user ? Object.keys(req.user) : [],
        willUseCache: !options.user_id
      });

      // Check cache first (only for non-authenticated requests to avoid userReaction issues)
      const cachedResult = !options.user_id ? cacheService.getCachedComments(options) : null;
      if (cachedResult) {
        return res.json({
          success: true,
          data: cachedResult.comments,
          pagination: cachedResult.pagination,
          cached: true
        });
      }

      // Get from service
      const result = await commentService.getComments(options);

      // Cache result
      cacheService.cacheComments(options, result, 300); // 5 minutes

      res.json({
        success: true,
        data: result.comments,
        pagination: result.pagination,
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
      // Debug logging
      console.log('[Comment Controller] Request user:', {
        hasUser: !!req.user,
        userId: req.user?._id,
        userKeys: req.user ? Object.keys(req.user) : [],
        userObject: req.user
      });

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
            console.log('[Comment Controller] Extracted user ID from token manually:', userId);
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

      console.log('[Comment Controller] Creating comment with userId:', userId);

      const commentData = req.body;

      // Get metadata from request
      const metadata = {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await commentService.createComment(userId, commentData, metadata);

      // Invalidate cache
      cacheService.invalidateOnNewComment(result.data);

      res.status(201).json(result);
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
      const { reason } = req.body;

      const result = await commentService.deleteComment(id, userId, reason);

      // Invalidate cache
      cacheService.invalidateStoryCache(req.body.story_id);
      if (req.body.chapter_id) {
        cacheService.invalidateChapterCache(req.body.chapter_id);
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

      // Invalidate related cache
      cacheService.invalidateThreadCache(id);

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

      // Check cache first (only for non-authenticated requests to avoid userReaction issues)
      const cachedThread = !userId ? cacheService.getCachedThread(id) : null;
      if (cachedThread) {
        return res.json({
          success: true,
          data: cachedThread,
          cached: true
        });
      }

      const result = await commentService.getCommentThread(id, userId);

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
        current_user_id: req.user?._id || req.user?.id
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
}

module.exports = new BaseCommentController();
