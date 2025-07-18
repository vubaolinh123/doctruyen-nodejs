const Comment = require('../../models/comment');
const User = require('../../models/user');
const crypto = require('crypto');
const commentQuoteUtils = require('../../utils/commentQuoteUtils');
const adminNotificationService = require('../notification/adminNotificationService');

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
        page = 1,
        limit = 10,
        sort = 'newest',
        include_replies = true,
        user_id = null,
        user_role = null
      } = options;

      let result;

      if (story_id && !chapter_id) {
        // Get story comments
        result = await Comment.getStoryComments({
          story_id,
          page,
          limit,
          sort,
          include_replies
        });
      } else if (chapter_id) {
        // Get chapter comments
        result = await Comment.getChapterComments({
          story_id,
          chapter_id,
          page,
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
            total: replies.length,
            totalPages: 1,
            page: 1,
            limit: parseInt(limit),
            hasMore: false,
            hasPrev: false
          }
        };
      } else {
        throw new Error('Thiếu thông tin story_id hoặc chapter_id');
      }

      // Add user interaction info if user is logged in
      if (user_id && result.comments.length > 0) {
        result.comments = await this.addUserInteractionInfo(result.comments, user_id, user_role);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo comment mới với smart quote support
   * @param {ObjectId} userId - ID của user
   * @param {Object} commentData - Dữ liệu comment
   * @param {Object} metadata - Metadata (IP, user agent, etc.)
   * @returns {Promise<Object>} - Comment đã tạo
   */
  async createComment(userId, commentData, metadata = {}) {
    try {
      console.log('[Comment Service] Creating comment with userId:', userId);
      console.log('[Comment Service] Comment data:', commentData);

      // Validate and convert userId to ObjectId if needed
      const mongoose = require('mongoose');
      let validUserId;

      if (typeof userId === 'string') {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          throw new Error('Invalid user ID format');
        }
        validUserId = new mongoose.Types.ObjectId(userId);
      } else if (userId instanceof mongoose.Types.ObjectId) {
        validUserId = userId;
      } else {
        throw new Error('User ID must be a string or ObjectId');
      }

      console.log('[Comment Service] Validated userId:', validUserId);

      const {
        content,
        target,
        hierarchy = {},
        metadata: bodyMetadata = {}
      } = commentData;

      // Extract content string from object or use as string
      let contentString = '';
      if (typeof content === 'string') {
        contentString = content;
      } else if (typeof content === 'object' && content.original) {
        contentString = content.original;
      } else {
        throw new Error('Content must be a string or object with original property');
      }

      console.log('[Comment Service] Extracted content:', {
        originalContent: content,
        contentType: typeof content,
        extractedString: contentString,
        stringLength: contentString.length
      });

      let parentComment = null;
      let finalContent = contentString;
      let quoteData = null;
      let finalParentId = hierarchy.parent_id;

      // Handle parent comment and quote logic
      if (hierarchy.parent_id) {
        parentComment = await Comment.findById(hierarchy.parent_id)
          .populate('user_id', 'name username slug');

        if (!parentComment) {
          throw new Error('Bình luận cha không tồn tại');
        }

        // Calculate target level
        const targetLevel = (parentComment.hierarchy?.level || 0) + 1;



        // Check if we need to convert Level 2+ to Level 1 with quote
        if (commentQuoteUtils.shouldConvertToQuotedReply(targetLevel, parentComment)) {
          console.log('[Comment Service] Converting Level 2+ to Level 1 with quote');
          console.log('[Comment Service] Content before quote formatting:', {
            originalContent: content,
            contentType: typeof content,
            finalContent: finalContent,
            finalContentType: typeof finalContent
          });

          // Generate quote data
          quoteData = commentQuoteUtils.generateQuoteData(parentComment, parentComment.user_id);

          // Format content with quote
          finalContent = commentQuoteUtils.formatQuotedComment(
            quoteData.quoted_username,
            quoteData.quoted_text,
            finalContent
          );

          console.log('[Comment Service] Content after quote formatting:', {
            formattedContent: finalContent,
            formattedContentType: typeof finalContent
          });

          // Get appropriate parent (Level 0 root comment)
          const quotedReplyParent = await commentQuoteUtils.getQuotedReplyParent(parentComment, Comment);
          finalParentId = quotedReplyParent._id;

          console.log('[Comment Service] Quote conversion:', {
            originalParent: parentComment._id,
            originalLevel: parentComment.hierarchy?.level,
            newParent: finalParentId,
            quotedUsername: quoteData.quoted_username,
            quotedText: quoteData.quoted_text
          });
        }
      }

      // Validate target data
      if (!target || !target.story_id) {
        throw new Error('Target story_id is required');
      }

      // Validate and convert target IDs to ObjectId if needed
      let validStoryId;
      if (typeof target.story_id === 'string') {
        if (!mongoose.Types.ObjectId.isValid(target.story_id)) {
          throw new Error('Invalid story ID format');
        }
        validStoryId = new mongoose.Types.ObjectId(target.story_id);
      } else if (target.story_id instanceof mongoose.Types.ObjectId) {
        validStoryId = target.story_id;
      } else {
        throw new Error('Story ID must be a string or ObjectId');
      }

      let validChapterId = null;
      if (target.chapter_id) {
        if (typeof target.chapter_id === 'string') {
          if (!mongoose.Types.ObjectId.isValid(target.chapter_id)) {
            throw new Error('Invalid chapter ID format');
          }
          validChapterId = new mongoose.Types.ObjectId(target.chapter_id);
        } else if (target.chapter_id instanceof mongoose.Types.ObjectId) {
          validChapterId = target.chapter_id;
        } else {
          throw new Error('Chapter ID must be a string or ObjectId');
        }
      }

      // Validate and convert parent_id if exists
      let validParentId = null;
      if (finalParentId) {
        if (typeof finalParentId === 'string') {
          if (!mongoose.Types.ObjectId.isValid(finalParentId)) {
            throw new Error('Invalid parent comment ID format');
          }
          validParentId = new mongoose.Types.ObjectId(finalParentId);
        } else if (finalParentId instanceof mongoose.Types.ObjectId) {
          validParentId = finalParentId;
        } else {
          throw new Error('Parent comment ID must be a string or ObjectId');
        }
      }

      // Prepare comment data
      const newCommentData = {
        user_id: validUserId,
        target: {
          story_id: validStoryId,
          chapter_id: validChapterId,
          type: target.type
        },
        content: {
          original: finalContent,
          sanitized: '', // Will be set in pre-save hook
          mentions: [],
          quote: quoteData || undefined // Add quote data if exists
        },
        hierarchy: {
          parent_id: validParentId,
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
        content: typeof newCommentData.content.original === 'string' ?
          newCommentData.content.original.substring(0, 100) + '...' :
          'Invalid content type: ' + typeof newCommentData.content.original,
        hasQuote: !!quoteData,
        finalParentId: validParentId
      });

      // Create comment
      const comment = new Comment(newCommentData);
      console.log('[Comment Service] Comment instance created, saving...');
      await comment.save();

      // Populate user info
      await comment.populate('user_id', 'name avatar slug level');

      // Track mission progress for comment-type missions
      let missionResults = null;
      try {
        missionResults = await this.trackCommentMissions(validUserId, comment);
      } catch (missionError) {
        // Log mission tracking errors but don't fail the comment creation
        console.error('[Mission Tracking] Error tracking comment missions:', {
          userId: validUserId,
          commentId: comment._id,
          error: missionError.message
        });
      }

      return {
        success: true,
        message: quoteData ?
          'Bình luận với trích dẫn đã được tạo thành công' :
          'Bình luận đã được tạo thành công',
        data: comment,
        quote_info: quoteData ? {
          is_quoted_reply: true,
          quoted_comment_id: quoteData.quoted_comment_id,
          quoted_username: quoteData.quoted_username
        } : null,
        missionProgress: missionResults
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
  async deleteComment(commentId, userId, reason = 'User deleted', userRole = null) {
    try {
      // Find comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Bình luận không tồn tại');
      }

      // Check permissions - Admin can delete any comment
      const isOwner = comment.user_id.toString() === userId.toString();
      const isAdmin = userRole === 'admin';

      if (!isOwner && !isAdmin) {
        throw new Error('Bạn không có quyền xóa bình luận này');
      }

      if (comment.moderation.status !== 'active') {
        throw new Error('Bình luận đã bị xóa hoặc ẩn');
      }

      // Set appropriate reason for admin deletion
      const deleteReason = isAdmin && !isOwner ? `Admin deleted: ${reason}` : reason;

      // Soft delete
      await comment.softDelete(deleteReason);

      // Handle admin deletion notifications and logging
      if (isAdmin && !isOwner) {
        try {
          // Send notification to comment owner
          await adminNotificationService.sendCommentDeletionNotification({
            adminId: userId,
            targetUserId: comment.user_id,
            commentId: commentId,
            reason: reason,
            storyId: comment.target.story_id,
            chapterId: comment.target.chapter_id
          });

          // Log admin action for audit
          await adminNotificationService.logAdminAction({
            adminId: userId,
            action: 'delete_comment',
            targetType: 'comment',
            targetId: commentId,
            reason: reason,
            metadata: {
              comment_owner: comment.user_id,
              story_id: comment.target.story_id,
              chapter_id: comment.target.chapter_id
            }
          });

        } catch (notificationError) {
          console.error('[CommentService] Error sending admin deletion notification:', notificationError);
          // Don't fail the deletion if notification fails
        }
      }

      return {
        success: true,
        message: isAdmin && !isOwner ?
          'Bình luận đã được xóa thành công. Người dùng đã được thông báo.' :
          'Bình luận đã được xóa thành công'
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
   * @param {String} userRole - Role của user (optional)
   * @returns {Promise<Object>} - Comment thread
   */
  async getCommentThread(rootId, userId = null, userRole = null) {
    try {
      const thread = await Comment.getCommentThread(rootId);

      if (!thread) {
        throw new Error('Bình luận không tồn tại');
      }

      // Add user interaction info if user is logged in
      if (userId) {
        await this.addUserInteractionInfoToThread(thread, userId, userRole);
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
        result.comments = await this.addUserInteractionInfo(result.comments, searchOptions.current_user_id, searchOptions.current_user_role);
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
   * Thêm reply counts chính xác cho danh sách comments
   * @param {Array} comments - Danh sách comments
   * @returns {Promise<Array>} - Comments với reply counts chính xác
   */
  async addReplyCountsToComments(comments) {
    try {
      if (!comments || comments.length === 0) {
        return comments;
      }

      // Get all comment IDs
      const commentIds = comments.map(comment => {
        const commentObj = comment.toObject ? comment.toObject() : comment;
        return commentObj._id;
      });

      // Aggregate reply counts for all comments in one query
      // Fixed: Only count actual replies (level > 0) and exclude self-references
      const replyCountsAggregation = await Comment.aggregate([
        {
          $match: {
            $and: [
              // Only count replies (level > 0), not root comments
              { 'hierarchy.level': { $gt: 0 } },
              // Match replies that belong to our target comments
              {
                $or: [
                  { 'hierarchy.parent_id': { $in: commentIds } },
                  { 'hierarchy.root_id': { $in: commentIds } }
                ]
              },
              // Only count active replies
              { 'moderation.status': 'active' },
              // Exclude self-references (comment cannot be reply to itself)
              { '_id': { $nin: commentIds } }
            ]
          }
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$hierarchy.level', 1] },
                '$hierarchy.parent_id',
                '$hierarchy.root_id'
              ]
            },
            replyCount: { $sum: 1 }
          }
        }
      ]);

      // Create a map of comment ID to reply count
      const replyCountMap = new Map();
      replyCountsAggregation.forEach(item => {
        if (item._id) {
          replyCountMap.set(item._id.toString(), item.replyCount);
        }
      });

      // Add reply counts to comments
      return comments.map(comment => {
        const commentObj = comment.toObject ? comment.toObject() : comment;
        const commentIdStr = commentObj._id.toString();

        // Get accurate reply count from aggregation
        const actualReplyCount = replyCountMap.get(commentIdStr) || 0;

        // Update the engagement.replies.count with accurate count
        if (!commentObj.engagement) {
          commentObj.engagement = {};
        }
        if (!commentObj.engagement.replies) {
          commentObj.engagement.replies = {};
        }
        commentObj.engagement.replies.count = actualReplyCount;

        return commentObj;
      });
    } catch (error) {
      console.error('Error adding reply counts to comments:', error);
      return comments; // Return original comments if error occurs
    }
  }

  /**
   * Thêm thông tin tương tác của user vào comments
   * @param {Array} comments - Danh sách comments
   * @param {ObjectId} userId - ID của user
   * @param {String} userRole - Role của user
   * @returns {Promise<Array>} - Comments với thông tin tương tác
   */
  async addUserInteractionInfo(comments, userId, userRole = null) {
    try {
      // First, calculate reply counts for all comments
      const commentsWithReplyCounts = await this.addReplyCountsToComments(comments);

      return commentsWithReplyCounts.map(comment => {
        const commentObj = comment.toObject ? comment.toObject() : comment;

        // Initialize variables outside of userId check to avoid scope issues
        const likesUsers = commentObj.engagement.likes.users || [];
        const dislikesUsers = commentObj.engagement.dislikes.users || [];
        const likesUsersStr = likesUsers.map(id => id.toString());
        const dislikesUsersStr = dislikesUsers.map(id => id.toString());

        // Check if user liked/disliked
        commentObj.userReaction = null;
        if (userId) {
          const userIdStr = userId.toString();

          if (likesUsersStr.includes(userIdStr)) {
            commentObj.userReaction = 'like';
          } else if (dislikesUsersStr.includes(userIdStr)) {
            commentObj.userReaction = 'dislike';
          }
        }

        // Check permissions for authenticated users only
        if (userId) {
          // Check if user can edit
          commentObj.canEdit = comment.canEdit ? comment.canEdit(userId) : false;

          // Check if user can delete - Admin can delete any comment
          const isOwner = commentObj.user_id.toString() === userId.toString();
          const isAdmin = userRole === 'admin';
          commentObj.canDelete = (isOwner || isAdmin) && commentObj.moderation.status === 'active';
        } else {
          // For non-authenticated users
          commentObj.canEdit = false;
          commentObj.canDelete = false;
        }

        // Add isEdited field from virtual or calculate it
        commentObj.isEdited = comment.isEdited ||
                             (commentObj.metadata.edit_history && commentObj.metadata.edit_history.length > 0);

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
   * @param {String} userRole - Role của user
   */
  async addUserInteractionInfoToThread(thread, userId, userRole = null) {
    try {
      // Add interaction info to root comment
      const rootWithInteraction = await this.addUserInteractionInfo([thread], userId, userRole);
      Object.assign(thread, rootWithInteraction[0]);

      // Recursively add interaction info to replies
      if (thread.replies && thread.replies.length > 0) {
        for (const reply of thread.replies) {
          await this.addUserInteractionInfoToThread(reply, userId, userRole);
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thông tin parent comment cho persistent reply form
   * @param {ObjectId} commentId - ID của comment (Level 1 comment)
   * @returns {Promise<Object>} - Parent comment info
   */
  async getParentCommentInfo(commentId) {
    try {
      // Find the comment
      const comment = await Comment.findById(commentId)
        .populate('user_id', 'name avatar slug')
        .lean();

      if (!comment) {
        throw new Error('Bình luận không tồn tại');
      }

      // Only allow Level 1 comments as parents for persistent reply form
      if (comment.hierarchy.level !== 1) {
        throw new Error('Chỉ có thể reply vào bình luận cấp 1');
      }

      if (comment.moderation.status !== 'active') {
        throw new Error('Không thể reply vào bình luận đã bị xóa hoặc ẩn');
      }

      // Get reply count
      const replyCount = await Comment.countDocuments({
        'hierarchy.parent_id': commentId,
        'moderation.status': 'active'
      });

      // Prepare parent info for persistent reply form
      const parentInfo = {
        _id: comment._id,
        author: {
          name: comment.user_id.name,
          avatar: comment.user_id.avatar,
          slug: comment.user_id.slug
        },
        content_snippet: comment.content.original.length > 100
          ? comment.content.original.substring(0, 100) + '...'
          : comment.content.original,
        reply_count: replyCount,
        created_at: comment.createdAt,
        target: comment.target
      };

      return {
        success: true,
        data: parentInfo
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Track mission progress for comment-type missions
   * @param {ObjectId} userId - ID của user
   * @param {Object} comment - Comment object
   * @returns {Promise<Array>} - Mission progress results
   */
  async trackCommentMissions(userId, comment) {
    try {
      console.log('[Mission Tracking] Starting comment mission tracking:', {
        userId,
        commentId: comment._id,
        storyId: comment.target.story_id,
        chapterId: comment.target.chapter_id
      });

      // Get all active missions that have comment requirements (main or sub-missions)
      const Mission = require('../../models/mission');
      const commentMissions = await Mission.find({
        $or: [
          { 'requirement.type': 'comment' }, // Main mission is comment type
          { 'subMissions.requirement.type': 'comment' } // Has comment sub-missions
        ],
        status: true
      });

      if (!commentMissions || commentMissions.length === 0) {
        console.log('[Mission Tracking] No active comment missions found');
        return [];
      }

      console.log('[Mission Tracking] Found comment missions:', {
        count: commentMissions.length,
        missions: commentMissions.map(m => ({ id: m._id, title: m.title, type: m.type }))
      });

      const missionResults = [];
      const MissionProgress = require('../../models/missionProgress');

      // Process each mission
      for (const mission of commentMissions) {
        try {
          // Check if this comment should count towards the mission
          const shouldCount = await this.shouldCountForCommentMission(userId, comment, mission);

          if (!shouldCount) {
            console.log('[Mission Tracking] Comment does not count for mission:', {
              missionId: mission._id,
              missionTitle: mission.title,
              reason: 'Conditions not met or already counted'
            });
            continue;
          }

          // Update main mission progress only if main requirement is comment type
          let progressResult = null;
          if (mission.requirement.type === 'comment') {
            progressResult = await MissionProgress.updateProgress(
              userId,
              mission._id,
              1, // Increment by 1 for each comment
              true // Increment mode
            );
          } else {
            // If main mission is not comment type, get existing progress without updating
            const date = new Date();
            progressResult = await MissionProgress.findOne({
              user_id: userId,
              mission_id: mission._id,
              year: date.getFullYear(),
              month: date.getMonth(),
              day: date.getDate()
            }) || {
              current_progress: 0,
              completed: false
            };
          }

          // Update sub-mission progress if applicable
          let subMissionResults = [];
          if (mission.subMissions && mission.subMissions.length > 0) {
            for (let subIndex = 0; subIndex < mission.subMissions.length; subIndex++) {
              const subMission = mission.subMissions[subIndex];

              // Check if this comment action should count for this sub-mission
              if (subMission.requirement.type === 'comment') {
                try {
                  const subProgressResult = await MissionProgress.updateSubMissionProgress(
                    userId,
                    mission._id,
                    subIndex,
                    1, // Increment by 1 for each comment
                    true // Increment mode
                  );

                  subMissionResults.push({
                    sub_mission_index: subIndex,
                    sub_mission_title: subMission.title,
                    sub_mission_type: subMission.requirement.type,
                    sub_mission_progress: subProgressResult.sub_progress.find(sp => sp.sub_mission_index === subIndex)
                  });

                  console.log('[Mission Tracking] Sub-mission progress updated:', {
                    missionId: mission._id,
                    subMissionIndex: subIndex,
                    subMissionTitle: subMission.title,
                    subMissionType: subMission.requirement.type
                  });
                } catch (subMissionError) {
                  console.error('[Mission Tracking] Error updating sub-mission progress:', {
                    missionId: mission._id,
                    subMissionIndex: subIndex,
                    error: subMissionError.message
                  });
                }
              }
            }
          }

          // CROSS-SERVICE SUB-MISSION TRACKING: Update sub-missions for other mission types
          // For example, if this is a read_chapter-type mission with comment sub-missions
          if (mission.requirement.type !== 'comment' && mission.subMissions && mission.subMissions.length > 0) {
            for (let subIndex = 0; subIndex < mission.subMissions.length; subIndex++) {
              const subMission = mission.subMissions[subIndex];

              // If this is a non-comment mission (e.g., read_chapter) with comment sub-missions
              if (subMission.requirement.type === 'comment') {
                try {
                  const subProgressResult = await MissionProgress.updateSubMissionProgress(
                    userId,
                    mission._id,
                    subIndex,
                    1, // Increment by 1 for each comment
                    true // Increment mode
                  );

                  subMissionResults.push({
                    sub_mission_index: subIndex,
                    sub_mission_title: subMission.title,
                    sub_mission_type: subMission.requirement.type,
                    sub_mission_progress: subProgressResult.sub_progress.find(sp => sp.sub_mission_index === subIndex)
                  });

                  console.log('[Mission Tracking] Cross-service sub-mission progress updated:', {
                    missionId: mission._id,
                    missionType: mission.requirement.type,
                    subMissionIndex: subIndex,
                    subMissionTitle: subMission.title,
                    subMissionType: subMission.requirement.type
                  });
                } catch (subMissionError) {
                  console.error('[Mission Tracking] Error updating cross-service sub-mission progress:', {
                    missionId: mission._id,
                    subMissionIndex: subIndex,
                    error: subMissionError.message
                  });
                }
              }
            }
          }

          console.log('[Mission Tracking] Mission progress updated:', {
            missionId: mission._id,
            missionTitle: mission.title,
            missionType: mission.type,
            previousProgress: progressResult.current_progress - 1,
            newProgress: progressResult.current_progress,
            required: mission.requirement.count,
            completed: progressResult.completed,
            subMissionsUpdated: subMissionResults.length
          });

          missionResults.push({
            mission_id: mission._id,
            mission_title: mission.title,
            mission_type: mission.type,
            previous_progress: progressResult.current_progress - 1,
            new_progress: progressResult.current_progress,
            required: mission.requirement.count,
            completed: progressResult.completed,
            newly_completed: progressResult.completed && (progressResult.current_progress - 1) < mission.requirement.count,
            sub_missions: subMissionResults
          });

        } catch (missionError) {
          console.error('[Mission Tracking] Error processing mission:', {
            missionId: mission._id,
            missionTitle: mission.title,
            error: missionError.message
          });
          // Continue with other missions even if one fails
        }
      }

      console.log('[Mission Tracking] Comment mission tracking completed:', {
        userId,
        commentId: comment._id,
        totalMissionUpdates: missionResults.length,
        newlyCompletedMissions: missionResults.filter(m => m.newly_completed).length
      });

      return missionResults;

    } catch (error) {
      console.error('[Mission Tracking] Error in trackCommentMissions:', error);
      throw error;
    }
  }

  /**
   * Check if a comment should count towards a specific mission
   * @param {ObjectId} userId - ID của user
   * @param {Object} comment - Comment object
   * @param {Object} mission - Mission object
   * @returns {Promise<boolean>} - Whether the comment should count
   */
  async shouldCountForCommentMission(userId, comment, mission) {
    try {
      // Basic validation
      if (!userId || !comment || !mission) {
        return false;
      }

      // Check if mission is active
      if (!mission.status) {
        return false;
      }

      // Check if mission type is comment
      if (mission.requirement.type !== 'comment') {
        return false;
      }

      // Check if comment is active (not deleted/hidden)
      if (comment.moderation.status !== 'active') {
        return false;
      }

      // Check mission conditions if any
      const conditions = mission.requirement.conditions || {};

      // Example condition checks (can be extended based on requirements):
      // - Minimum comment length
      if (conditions.min_length && comment.content.original.length < conditions.min_length) {
        console.log('[Mission Tracking] Comment too short for mission:', {
          missionId: mission._id,
          commentLength: comment.content.original.length,
          requiredLength: conditions.min_length
        });
        return false;
      }

      // - Specific story/chapter restrictions
      if (conditions.story_ids && conditions.story_ids.length > 0) {
        if (!conditions.story_ids.includes(comment.target.story_id.toString())) {
          console.log('[Mission Tracking] Comment not on required story for mission:', {
            missionId: mission._id,
            commentStoryId: comment.target.story_id,
            requiredStoryIds: conditions.story_ids
          });
          return false;
        }
      }

      // - Comment type restrictions (story vs chapter comments)
      if (conditions.comment_type && conditions.comment_type !== comment.target.type) {
        console.log('[Mission Tracking] Comment type mismatch for mission:', {
          missionId: mission._id,
          commentType: comment.target.type,
          requiredType: conditions.comment_type
        });
        return false;
      }

      // Check time-based restrictions for mission progress
      const today = new Date();
      const MissionProgress = require('../../models/missionProgress');

      // Build time query based on mission type
      let timeQuery = {};
      if (mission.type === 'daily') {
        timeQuery = {
          day: today.getDate(),
          month: today.getMonth(),
          year: today.getFullYear()
        };
      } else if (mission.type === 'weekly') {
        const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
        const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
        const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        timeQuery = {
          week: week,
          year: today.getFullYear()
        };
      }

      // Check if there's already a progress record for this mission and time period
      const existingProgress = await MissionProgress.findOne({
        user_id: userId,
        mission_id: mission._id,
        ...timeQuery
      });

      // For comment missions, we allow multiple comments to count towards the same mission
      // This is different from reading missions where we might want to prevent duplicate counting
      // of the same chapter within the same time period

      console.log('[Mission Tracking] Mission conditions check passed:', {
        missionId: mission._id,
        missionTitle: mission.title,
        missionType: mission.type,
        hasExistingProgress: !!existingProgress,
        currentProgress: existingProgress?.current_progress || 0
      });

      return true;

    } catch (error) {
      console.error('[Mission Tracking] Error in shouldCountForCommentMission:', error);
      return false;
    }
  }
}

module.exports = new CommentService();
