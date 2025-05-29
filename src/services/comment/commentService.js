const Comment = require('../../models/comment');
const User = require('../../models/user');
const crypto = require('crypto');

/**
 * Service xử lý business logic cho comment system
 */
class CommentService {

  /**
   * Lấy danh sách comments với pagination tối ưu
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Comments và pagination info
   */
  async getComments(options) {
    try {
      const {
        story_id,
        chapter_id,
        parent_id,
        cursor,
        limit = 20,
        sort = 'newest',
        include_replies = false,
        user_id = null
      } = options;

      let result;

      if (story_id && !chapter_id) {
        // Get story comments
        result = await Comment.getStoryComments({
          story_id,
          cursor,
          limit,
          sort,
          include_replies
        });
      } else if (chapter_id) {
        // Get chapter comments
        result = await Comment.getChapterComments({
          story_id,
          chapter_id,
          cursor,
          limit,
          sort,
          include_replies
        });
      } else if (parent_id) {
        // Get replies
        const replies = await Comment.getReplies(parent_id, { limit, sort });
        result = {
          comments: replies,
          pagination: {
            hasMore: false,
            nextCursor: null,
            limit: parseInt(limit)
          }
        };
      } else {
        throw new Error('Thiếu thông tin story_id hoặc chapter_id');
      }

      // Add user interaction info if user is logged in
      if (user_id && result.comments.length > 0) {
        result.comments = await this.addUserInteractionInfo(result.comments, user_id);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo comment mới
   * @param {ObjectId} userId - ID của user
   * @param {Object} commentData - Dữ liệu comment
   * @param {Object} metadata - Metadata (IP, user agent, etc.)
   * @returns {Promise<Object>} - Comment đã tạo
   */
  async createComment(userId, commentData, metadata = {}) {
    try {
      console.log('[Comment Service] Creating comment with userId:', userId);
      console.log('[Comment Service] Comment data:', commentData);

      const {
        content,
        target,
        hierarchy = {},
        metadata: bodyMetadata = {}
      } = commentData;

      // Prepare comment data
      const newCommentData = {
        user_id: userId,
        target: {
          story_id: target.story_id,
          chapter_id: target.chapter_id || null,
          type: target.type
        },
        content: {
          original: content,
          sanitized: '', // Will be set in pre-save hook
          mentions: []
        },
        hierarchy: {
          parent_id: hierarchy.parent_id || null,
          level: 0, // Will be calculated in pre-save hook
          path: '', // Will be calculated in pre-save hook
          root_id: null // Will be calculated in pre-save hook
        },
        metadata: {
          ...bodyMetadata,
          ip_address: metadata.ip, // Will be hashed in pre-save hook
          user_agent: metadata.userAgent, // Will be hashed in pre-save hook
          chapter_position: bodyMetadata.chapter_position || null
        }
      };

      console.log('[Comment Service] Prepared comment data:', {
        user_id: newCommentData.user_id,
        hasUserId: !!newCommentData.user_id,
        userIdType: typeof newCommentData.user_id,
        target: newCommentData.target,
        content: newCommentData.content.original
      });

      // Create comment
      const comment = new Comment(newCommentData);
      console.log('[Comment Service] Comment instance created, saving...');
      await comment.save();

      // Populate user info
      await comment.populate('user_id', 'name avatar slug level');

      return {
        success: true,
        message: 'Bình luận đã được tạo thành công',
        data: comment
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật comment
   * @param {ObjectId} commentId - ID của comment
   * @param {ObjectId} userId - ID của user
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Comment đã cập nhật
   */
  async updateComment(commentId, userId, updateData) {
    try {
      const { content, edit_reason = '' } = updateData;

      // Find comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Bình luận không tồn tại');
      }

      // Check permissions
      if (!comment.canEdit(userId)) {
        throw new Error('Bạn không có quyền chỉnh sửa bình luận này hoặc đã quá thời hạn chỉnh sửa');
      }

      // Update content
      await comment.editContent(content, edit_reason);

      // Populate user info
      await comment.populate('user_id', 'name avatar slug level');

      return {
        success: true,
        message: 'Bình luận đã được cập nhật thành công',
        data: comment
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa comment (soft delete)
   * @param {ObjectId} commentId - ID của comment
   * @param {ObjectId} userId - ID của user
   * @param {String} reason - Lý do xóa
   * @returns {Promise<Object>} - Kết quả xóa
   */
  async deleteComment(commentId, userId, reason = 'User deleted') {
    try {
      // Find comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Bình luận không tồn tại');
      }

      // Check permissions
      if (comment.user_id.toString() !== userId.toString()) {
        throw new Error('Bạn không có quyền xóa bình luận này');
      }

      if (comment.moderation.status !== 'active') {
        throw new Error('Bình luận đã bị xóa hoặc ẩn');
      }

      // Soft delete
      await comment.softDelete(reason);

      return {
        success: true,
        message: 'Bình luận đã được xóa thành công'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Like/Dislike/Remove reaction
   * @param {ObjectId} commentId - ID của comment
   * @param {ObjectId} userId - ID của user
   * @param {String} action - 'like', 'dislike', 'remove'
   * @returns {Promise<Object>} - Kết quả action
   */
  async toggleReaction(commentId, userId, action) {
    try {
      // Find comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Bình luận không tồn tại');
      }

      if (comment.moderation.status !== 'active') {
        throw new Error('Không thể tương tác với bình luận đã bị xóa hoặc ẩn');
      }

      let result;
      switch (action) {
        case 'like':
          result = await comment.addLike(userId);
          break;
        case 'dislike':
          result = await comment.addDislike(userId);
          break;
        case 'remove':
          result = await comment.removeLikeDislike(userId);
          break;
        default:
          throw new Error('Action không hợp lệ');
      }

      // Enhanced response với userReaction status
      if (result.success) {
        // Determine current user reaction after the action
        let userReaction = null;
        if (comment.engagement.likes.users.includes(userId.toString())) {
          userReaction = 'like';
        } else if (comment.engagement.dislikes.users.includes(userId.toString())) {
          userReaction = 'dislike';
        }

        return {
          ...result,
          data: {
            likes: result.likes,
            dislikes: result.dislikes,
            userReaction: userReaction
          }
        };
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Flag comment
   * @param {ObjectId} commentId - ID của comment
   * @param {ObjectId} userId - ID của user
   * @param {String} reason - Lý do flag
   * @param {String} description - Mô tả chi tiết
   * @returns {Promise<Object>} - Kết quả flag
   */
  async flagComment(commentId, userId, reason, description = '') {
    try {
      // Find comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Bình luận không tồn tại');
      }

      if (comment.user_id.toString() === userId.toString()) {
        throw new Error('Bạn không thể báo cáo bình luận của chính mình');
      }

      // Add flag
      const result = await comment.addFlag(userId, reason);

      // Log flag for admin review
      console.log(`Comment flagged: ${commentId} by user ${userId} for reason: ${reason}`);

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy comment thread (root + all nested replies)
   * @param {ObjectId} rootId - ID của root comment
   * @param {ObjectId} userId - ID của user (optional)
   * @returns {Promise<Object>} - Comment thread
   */
  async getCommentThread(rootId, userId = null) {
    try {
      const thread = await Comment.getCommentThread(rootId);

      if (!thread) {
        throw new Error('Bình luận không tồn tại');
      }

      // Add user interaction info if user is logged in
      if (userId) {
        await this.addUserInteractionInfoToThread(thread, userId);
      }

      return {
        success: true,
        data: thread
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search comments
   * @param {Object} searchOptions - Search options
   * @returns {Promise<Object>} - Search results
   */
  async searchComments(searchOptions) {
    try {
      const result = await Comment.searchComments(searchOptions);

      // Add user interaction info if user is logged in
      if (searchOptions.current_user_id && result.comments.length > 0) {
        result.comments = await this.addUserInteractionInfo(result.comments, searchOptions.current_user_id);
      }

      return {
        success: true,
        data: result.comments,
        pagination: result.pagination
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thống kê comments
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} - Statistics
   */
  async getCommentStats(options) {
    try {
      const stats = await Comment.getCommentStats(options);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Thêm thông tin tương tác của user vào comments
   * @param {Array} comments - Danh sách comments
   * @param {ObjectId} userId - ID của user
   * @returns {Promise<Array>} - Comments với thông tin tương tác
   */
  async addUserInteractionInfo(comments, userId) {
    try {
      return comments.map(comment => {
        const commentObj = comment.toObject ? comment.toObject() : comment;

        // Check if user liked/disliked
        commentObj.userReaction = null;
        const userIdStr = userId.toString();
        const likesUsers = commentObj.engagement.likes.users || [];
        const dislikesUsers = commentObj.engagement.dislikes.users || [];

        // Convert ObjectIds to strings for comparison
        const likesUsersStr = likesUsers.map(id => id.toString());
        const dislikesUsersStr = dislikesUsers.map(id => id.toString());

        if (likesUsersStr.includes(userIdStr)) {
          commentObj.userReaction = 'like';
        } else if (dislikesUsersStr.includes(userIdStr)) {
          commentObj.userReaction = 'dislike';
        }

        // Debug logging for userReaction
        if (process.env.NODE_ENV === 'development') {
          console.log('[CommentService] UserReaction Debug:', {
            commentId: commentObj._id,
            userId: userIdStr,
            likesUsers: likesUsers,
            likesUsersStr: likesUsersStr,
            dislikesUsers: dislikesUsers,
            dislikesUsersStr: dislikesUsersStr,
            userInLikesOriginal: likesUsers.includes(userIdStr),
            userInLikesConverted: likesUsersStr.includes(userIdStr),
            userInDislikesOriginal: dislikesUsers.includes(userIdStr),
            userInDislikesConverted: dislikesUsersStr.includes(userIdStr),
            finalUserReaction: commentObj.userReaction
          });
        }

        // Check if user can edit
        commentObj.canEdit = comment.canEdit ? comment.canEdit(userId) : false;

        // Check if user can delete
        commentObj.canDelete = commentObj.user_id.toString() === userId.toString() &&
                              commentObj.moderation.status === 'active';

        return commentObj;
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Thêm thông tin tương tác của user vào comment thread
   * @param {Object} thread - Comment thread
   * @param {ObjectId} userId - ID của user
   */
  async addUserInteractionInfoToThread(thread, userId) {
    try {
      // Add interaction info to root comment
      const rootWithInteraction = await this.addUserInteractionInfo([thread], userId);
      Object.assign(thread, rootWithInteraction[0]);

      // Recursively add interaction info to replies
      if (thread.replies && thread.replies.length > 0) {
        for (const reply of thread.replies) {
          await this.addUserInteractionInfoToThread(reply, userId);
        }
      }
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new CommentService();
