/**
 * Static methods cho Comment model
 * Các phương thức được gọi trên model class
 */
const setupStatics = (schema) => {

  /**
   * Lấy comments của story với pagination tối ưu (page-based)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Comments và pagination info
   */
  schema.statics.getStoryComments = async function(options) {
    const {
      story_id,
      page = 1,
      limit = 10, // Changed to 10 root comments per page
      sort = 'newest', // newest, oldest, hot, most_liked
      include_replies = true // Always include replies for proper tree structure
    } = options;

    try {
      const query = {
        'target.story_id': story_id,
        'target.type': 'story',
        'moderation.status': 'active'
      };

      // Build sort criteria with support for all filter types
      let sortCriteria = {};
      if (sort === 'newest') {
        sortCriteria = { createdAt: -1 };
      } else if (sort === 'oldest') {
        sortCriteria = { createdAt: 1 };
      } else if (sort === 'hot' || sort === 'popular') {
        sortCriteria = { 'engagement.score': -1, createdAt: -1 };
      } else if (sort === 'most_liked') {
        sortCriteria = { 'engagement.likes.count': -1, createdAt: -1 };
      }

      if (include_replies) {
        // Get all comments (root + replies) for tree structure
        const allComments = await this.find(query)
          .sort(sortCriteria)
          .populate('user_id', 'name avatar slug level role')
          .populate('content.mentions.user_id', 'name slug')
          .lean();

        // Get root comments for pagination
        const rootQuery = {
          ...query,
          'hierarchy.level': 0
        };

        const totalRootComments = await this.countDocuments(rootQuery);
        const totalPages = Math.ceil(totalRootComments / limit);
        const skip = (page - 1) * limit;

        const rootComments = await this.find(rootQuery)
          .sort(sortCriteria)
          .skip(skip)
          .limit(parseInt(limit))
          .select('_id')
          .lean();

        const rootCommentIds = rootComments.map(c => c._id.toString());

        // Filter all comments to only include those in current page + their replies
        const pageComments = allComments.filter(comment => {
          if (comment.hierarchy.level === 0) {
            return rootCommentIds.includes(comment._id.toString());
          } else {
            // Include replies if their root comment is in current page
            return rootCommentIds.includes(comment.hierarchy.root_id?.toString());
          }
        });

        // Calculate total comments including replies
        const totalAllComments = allComments.length;

        return {
          comments: pageComments,
          pagination: {
            total: totalAllComments, // Total all comments (root + replies)
            totalRootComments: totalRootComments, // Total root comments only
            totalPages,
            page: parseInt(page),
            limit: parseInt(limit),
            hasMore: page < totalPages,
            hasPrev: page > 1
          }
        };
      } else {
        // Only root comments
        const rootQuery = {
          ...query,
          'hierarchy.level': 0
        };

        const total = await this.countDocuments(rootQuery);
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;

        const comments = await this.find(rootQuery)
          .sort(sortCriteria)
          .skip(skip)
          .limit(parseInt(limit))
          .populate('user_id', 'name avatar slug level role')
          .populate('content.mentions.user_id', 'name slug')
          .lean();

        return {
          comments,
          pagination: {
            total,
            totalRootComments: total,
            totalPages,
            page: parseInt(page),
            limit: parseInt(limit),
            hasMore: page < totalPages,
            hasPrev: page > 1
          }
        };
      }
    } catch (error) {
      throw error;
    }
  };

  /**
   * Lấy comments của chapter với pagination tối ưu (page-based)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Comments và pagination info
   */
  schema.statics.getChapterComments = async function(options) {
    const {
      story_id,
      chapter_id,
      page = 1,
      limit = 10,
      sort = 'newest',
      include_replies = true
    } = options;

    try {
      const query = {
        'target.story_id': story_id,
        'target.chapter_id': chapter_id,
        'target.type': 'chapter',
        'moderation.status': 'active'
      };

      // Build sort criteria with support for all filter types
      let sortCriteria = {};
      if (sort === 'newest') {
        sortCriteria = { createdAt: -1 };
      } else if (sort === 'oldest') {
        sortCriteria = { createdAt: 1 };
      } else if (sort === 'hot' || sort === 'popular') {
        sortCriteria = { 'engagement.score': -1, createdAt: -1 };
      } else if (sort === 'most_liked') {
        sortCriteria = { 'engagement.likes.count': -1, createdAt: -1 };
      }

      if (include_replies) {
        // Get all comments (root + replies) for tree structure
        const allComments = await this.find(query)
          .sort(sortCriteria)
          .populate('user_id', 'name avatar slug level role')
          .populate('content.mentions.user_id', 'name slug')
          .lean();

        // Get root comments for pagination
        const rootQuery = {
          ...query,
          'hierarchy.level': 0
        };

        const totalRootComments = await this.countDocuments(rootQuery);
        const totalPages = Math.ceil(totalRootComments / limit);
        const skip = (page - 1) * limit;

        const rootComments = await this.find(rootQuery)
          .sort(sortCriteria)
          .skip(skip)
          .limit(parseInt(limit))
          .select('_id')
          .lean();

        const rootCommentIds = rootComments.map(c => c._id.toString());

        // Filter all comments to only include those in current page + their replies
        const pageComments = allComments.filter(comment => {
          if (comment.hierarchy.level === 0) {
            return rootCommentIds.includes(comment._id.toString());
          } else {
            // Include replies if their root comment is in current page
            return rootCommentIds.includes(comment.hierarchy.root_id?.toString());
          }
        });

        // Calculate total comments including replies
        const totalAllComments = allComments.length;

        return {
          comments: pageComments,
          pagination: {
            total: totalAllComments, // Total all comments (root + replies)
            totalRootComments: totalRootComments, // Total root comments only
            totalPages,
            page: parseInt(page),
            limit: parseInt(limit),
            hasMore: page < totalPages,
            hasPrev: page > 1
          }
        };
      } else {
        // Only root comments
        const rootQuery = {
          ...query,
          'hierarchy.level': 0
        };

        const total = await this.countDocuments(rootQuery);
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;

        const comments = await this.find(rootQuery)
          .sort(sortCriteria)
          .skip(skip)
          .limit(parseInt(limit))
          .populate('user_id', 'name avatar slug level role')
          .populate('content.mentions.user_id', 'name slug')
          .lean();

        return {
          comments,
          pagination: {
            total,
            totalRootComments: total,
            totalPages,
            page: parseInt(page),
            limit: parseInt(limit),
            hasMore: page < totalPages,
            hasPrev: page > 1
          }
        };
      }
    } catch (error) {
      throw error;
    }
  };

  /**
   * Lấy replies của một comment (sử dụng materialized path)
   * @param {ObjectId} parentId - ID của parent comment
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of replies
   */
  schema.statics.getReplies = async function(parentId, options = {}) {
    const { limit = 10, sort = 'oldest' } = options;

    try {
      // Find parent comment to get its path
      const parentComment = await this.findById(parentId).lean();
      if (!parentComment) {
        throw new Error('Parent comment not found');
      }

      // Build path pattern for direct children
      const childPathPattern = new RegExp(`^${parentComment.hierarchy.path}[^/]+/$`);

      const query = {
        'hierarchy.path': childPathPattern,
        'moderation.status': 'active'
      };

      let sortCriteria = {};
      if (sort === 'oldest') {
        sortCriteria = { createdAt: 1 };
      } else if (sort === 'newest') {
        sortCriteria = { createdAt: -1 };
      } else if (sort === 'popular') {
        sortCriteria = { 'engagement.score': -1, createdAt: 1 };
      }

      const replies = await this.find(query)
        .sort(sortCriteria)
        .limit(parseInt(limit))
        .populate('user_id', 'name avatar slug')
        .populate('content.mentions.user_id', 'name slug')
        .lean();

      return replies;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Lấy toàn bộ comment thread (root + all nested replies)
   * @param {ObjectId} rootId - ID của root comment
   * @returns {Promise<Array>} - Nested comment structure
   */
  schema.statics.getCommentThread = async function(rootId) {
    try {
      // Get root comment
      const rootComment = await this.findById(rootId)
        .populate('user_id', 'name avatar slug')
        .lean();

      if (!rootComment || rootComment.moderation.status !== 'active') {
        return null;
      }

      // Get all descendants using materialized path
      const descendants = await this.find({
        'hierarchy.path': new RegExp(`^${rootComment.hierarchy.path}`),
        'moderation.status': 'active'
      })
        .sort({ 'hierarchy.level': 1, createdAt: 1 })
        .populate('user_id', 'name avatar slug')
        .lean();

      // Build nested structure
      const commentMap = new Map();
      commentMap.set(rootComment._id.toString(), { ...rootComment, replies: [] });

      descendants.forEach(comment => {
        commentMap.set(comment._id.toString(), { ...comment, replies: [] });

        if (comment.hierarchy.parent_id) {
          const parent = commentMap.get(comment.hierarchy.parent_id.toString());
          if (parent) {
            parent.replies.push(commentMap.get(comment._id.toString()));
          }
        }
      });

      return commentMap.get(rootComment._id.toString());
    } catch (error) {
      throw error;
    }
  };

  /**
   * Search comments
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Search results
   */
  schema.statics.searchComments = async function(options) {
    const {
      query,
      story_id = null,
      chapter_id = null,
      user_id = null,
      limit = 20,
      skip = 0
    } = options;

    try {
      const searchQuery = {
        'moderation.status': 'active',
        $text: { $search: query }
      };

      if (story_id) {
        searchQuery['target.story_id'] = story_id;
      }

      if (chapter_id) {
        searchQuery['target.chapter_id'] = chapter_id;
      }

      if (user_id) {
        searchQuery.user_id = user_id;
      }

      const comments = await this.find(searchQuery, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('user_id', 'name avatar slug')
        .lean();

      const total = await this.countDocuments(searchQuery);

      return {
        comments,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      throw error;
    }
  };

  /**
   * Lấy comments cần moderation
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Comments cần review
   */
  schema.statics.getModerationQueue = async function(options = {}) {
    const { limit = 50, skip = 0, status = 'pending' } = options;

    try {
      const query = {
        'moderation.status': status
      };

      // Sắp xếp theo số flags và thời gian tạo
      const comments = await this.find(query)
        .sort({ 'moderation.flags.count': -1, createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('user_id', 'name avatar slug')
        .populate('target.story_id', 'title slug')
        .populate('target.chapter_id', 'title chapter_number')
        .lean();

      const total = await this.countDocuments(query);

      return {
        comments,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      throw error;
    }
  };

  /**
   * Lấy thống kê comments
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} - Statistics
   */
  schema.statics.getCommentStats = async function(options = {}) {
    const { story_id = null, chapter_id = null, timeRange = '7d' } = options;

    try {
      // Calculate date range
      const now = new Date();
      let startDate;

      switch (timeRange) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const baseQuery = {
        createdAt: { $gte: startDate }
      };

      if (story_id) {
        baseQuery['target.story_id'] = story_id;
      }

      if (chapter_id) {
        baseQuery['target.chapter_id'] = chapter_id;
      }

      const stats = await this.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: null,
            totalComments: { $sum: 1 },
            activeComments: {
              $sum: { $cond: [{ $eq: ['$moderation.status', 'active'] }, 1, 0] }
            },
            deletedComments: {
              $sum: { $cond: [{ $eq: ['$moderation.status', 'deleted'] }, 1, 0] }
            },
            flaggedComments: {
              $sum: { $cond: [{ $gt: ['$moderation.flags.count', 0] }, 1, 0] }
            },
            totalLikes: { $sum: '$engagement.likes.count' },
            totalDislikes: { $sum: '$engagement.dislikes.count' },
            avgEngagementScore: { $avg: '$engagement.score' }
          }
        }
      ]);

      return stats[0] || {
        totalComments: 0,
        activeComments: 0,
        deletedComments: 0,
        flaggedComments: 0,
        totalLikes: 0,
        totalDislikes: 0,
        avgEngagementScore: 0
      };
    } catch (error) {
      throw error;
    }
  };
};

module.exports = setupStatics;
