const crypto = require('crypto');

/**
 * Hooks (middleware) cho Comment model
 * Pre/post hooks cho các operations
 */
const setupHooks = (schema) => {

  /**
   * Pre-save hook: Xử lý trước khi save
   */
  schema.pre('save', async function(next) {
    try {
      // Nếu là document mới
      if (this.isNew) {
        // Sanitize content
        if (this.content.original && !this.content.sanitized) {
          this.content.sanitized = this.sanitizeContent(this.content.original);
        }

        // Set up hierarchy cho comment mới
        await this.setupHierarchy();

        // Generate IP hash nếu có
        if (this.metadata && this.metadata.ip_address) {
          this.metadata.ip_hash = crypto
            .createHash('sha256')
            .update(this.metadata.ip_address + process.env.HASH_SALT || 'default_salt')
            .digest('hex');
          delete this.metadata.ip_address; // Remove raw IP
        }

        // Generate user agent hash nếu có
        if (this.metadata && this.metadata.user_agent) {
          this.metadata.user_agent_hash = crypto
            .createHash('sha256')
            .update(this.metadata.user_agent + process.env.HASH_SALT || 'default_salt')
            .digest('hex');
          delete this.metadata.user_agent; // Remove raw user agent
        }

        // Set initial engagement score
        this.updateEngagementScore();
      }

      // Nếu content được update
      if (this.isModified('content.original')) {
        this.content.sanitized = this.sanitizeContent(this.content.original);
      }

      // Update engagement score nếu engagement data thay đổi
      if (this.isModified('engagement.likes.count') ||
          this.isModified('engagement.dislikes.count') ||
          this.isModified('engagement.replies.count')) {
        this.updateEngagementScore();
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Pre-save hook: Setup hierarchy cho comment mới
   */
  schema.methods.setupHierarchy = async function() {
    // Ensure _id exists before using it
    if (!this._id) {
      this._id = new this.constructor.base.Types.ObjectId();
    }

    // Ensure _id is valid before calling toString()
    if (!this._id || typeof this._id.toString !== 'function') {
      throw new Error('Invalid comment ID');
    }

    if (this.hierarchy.parent_id) {
      // Đây là reply comment
      const parentComment = await this.constructor.findById(this.hierarchy.parent_id);

      if (!parentComment) {
        throw new Error('Parent comment not found');
      }

      // Check depth limit
      if (parentComment.hierarchy.level >= 3) {
        throw new Error('Maximum nesting level reached');
      }

      // Set hierarchy properties
      this.hierarchy.level = parentComment.hierarchy.level + 1;
      this.hierarchy.root_id = parentComment.hierarchy.root_id || parentComment._id;
      this.hierarchy.path = (parentComment.hierarchy.path || '/') + this._id.toString() + '/';
    } else {
      // Đây là root comment
      this.hierarchy.level = 0;
      this.hierarchy.root_id = this._id;
      this.hierarchy.path = '/' + this._id.toString() + '/';
    }
  };

  /**
   * Post-save hook: Xử lý sau khi save
   */
  schema.post('save', async function(doc, next) {
    try {
      // Nếu là comment mới
      if (doc.wasNew) {
        // Update reply count của parent nếu có
        if (doc.hierarchy.parent_id) {
          await doc.constructor.findByIdAndUpdate(
            doc.hierarchy.parent_id,
            {
              $inc: { 'engagement.replies.count': 1 },
              $set: { 'engagement.replies.last_reply_at': new Date() }
            }
          );
        }

        // Update user comment count
        const User = require('../user');
        await User.findByIdAndUpdate(
          doc.user_id,
          { $inc: { 'stats.comment_count': 1 } }
        );

        // Update story/chapter comment count
        if (doc.target.type === 'story') {
          const Story = require('../story');
          await Story.findByIdAndUpdate(
            doc.target.story_id,
            { $inc: { 'stats.comment_count': 1 } }
          );
        } else if (doc.target.type === 'chapter') {
          const Chapter = require('../chapter');
          await Chapter.findByIdAndUpdate(
            doc.target.chapter_id,
            { $inc: { 'stats.comment_count': 1 } }
          );
        }

        // Trigger notifications cho mentions
        if (doc.content.mentions && doc.content.mentions.length > 0) {
          await this.triggerMentionNotifications(doc);
        }

        // Trigger notification cho parent comment owner
        if (doc.hierarchy.parent_id) {
          await this.triggerReplyNotification(doc);
        }
      }

      // Nếu moderation status thay đổi
      if (doc.isModified('moderation.status')) {
        await this.handleModerationStatusChange(doc);
      }

      next();
    } catch (error) {
      console.error('Post-save hook error:', error);
      next(); // Don't fail the save operation
    }
  });

  /**
   * Trigger notifications cho user mentions
   */
  schema.methods.triggerMentionNotifications = async function(doc) {
    try {
      const User = require('../user');
      const Notification = require('../notification'); // Assuming you have notification model

      for (const mention of doc.content.mentions) {
        // Find user by username
        const mentionedUser = await User.findOne({
          $or: [
            { username: mention.username },
            { slug: mention.username }
          ]
        });

        if (mentionedUser && mentionedUser._id.toString() !== doc.user_id.toString()) {
          // Create notification
          await Notification.create({
            user_id: mentionedUser._id,
            type: 'comment_mention',
            title: 'Bạn được nhắc đến trong bình luận',
            message: `${doc.user?.name || 'Ai đó'} đã nhắc đến bạn trong một bình luận`,
            data: {
              comment_id: doc._id,
              story_id: doc.target.story_id,
              chapter_id: doc.target.chapter_id,
              mentioned_by: doc.user_id
            },
            url: doc.url
          });
        }
      }
    } catch (error) {
      console.error('Error triggering mention notifications:', error);
    }
  };

  /**
   * Trigger notification cho reply
   */
  schema.methods.triggerReplyNotification = async function(doc) {
    try {
      const parentComment = await doc.constructor.findById(doc.hierarchy.parent_id)
        .populate('user_id', 'name');

      if (parentComment &&
          parentComment.user_id._id.toString() !== doc.user_id.toString()) {

        const notificationService = require('../../services/notificationService');

        // Get user data for the reply
        const User = require('../user');
        const repliedBy = await User.findById(doc.user_id, 'name avatar slug');

        await notificationService.createCommentReplyNotification({
          parentComment: parentComment,
          replyComment: doc,
          repliedBy: repliedBy
        });
      }

      // Handle quoted reply notifications
      if (doc.content?.quote?.quoted_comment_id && doc.content?.quote?.is_level_conversion) {
        try {
          const quotedComment = await doc.constructor.findById(doc.content.quote.quoted_comment_id)
            .populate('user_id', 'name');

          if (quotedComment &&
              quotedComment.user_id._id.toString() !== doc.user_id.toString()) {

            const notificationService = require('../../services/notificationService');
            const User = require('../user');
            const quotedBy = await User.findById(doc.user_id, 'name avatar slug');

            await notificationService.createQuotedReplyNotification({
              quotedComment: quotedComment,
              newComment: doc,
              quotedBy: quotedBy
            });
          }
        } catch (error) {
          console.error('Error triggering quoted reply notification:', error);
        }
      }
    } catch (error) {
      console.error('Error triggering reply notification:', error);
    }
  };

  /**
   * Handle moderation status changes
   */
  schema.methods.handleModerationStatusChange = async function(doc) {
    try {
      const User = require('../user');

      if (doc.moderation.status === 'deleted' || doc.moderation.status === 'spam') {
        // Decrease user comment count
        await User.findByIdAndUpdate(
          doc.user_id,
          { $inc: { 'stats.comment_count': -1 } }
        );

        // Decrease story/chapter comment count
        if (doc.target.type === 'story') {
          const Story = require('../story');
          await Story.findByIdAndUpdate(
            doc.target.story_id,
            { $inc: { 'stats.comment_count': -1 } }
          );
        } else if (doc.target.type === 'chapter') {
          const Chapter = require('../chapter');
          await Chapter.findByIdAndUpdate(
            doc.target.chapter_id,
            { $inc: { 'stats.comment_count': -1 } }
          );
        }

        // Decrease parent reply count
        if (doc.hierarchy.parent_id) {
          await doc.constructor.findByIdAndUpdate(
            doc.hierarchy.parent_id,
            { $inc: { 'engagement.replies.count': -1 } }
          );
        }
      }
    } catch (error) {
      console.error('Error handling moderation status change:', error);
    }
  };

  /**
   * Pre-remove hook: Xử lý trước khi xóa
   */
  schema.pre('remove', async function(next) {
    try {
      // Soft delete all child comments
      await this.constructor.updateMany(
        { 'hierarchy.path': new RegExp(`^${this.hierarchy.path}`) },
        {
          $set: {
            'moderation.status': 'deleted',
            'moderation.moderation_reason': 'Parent comment deleted',
            'moderation.moderated_at': new Date()
          }
        }
      );

      next();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Pre-validate hook: Validation trước khi save
   */
  schema.pre('validate', function(next) {
    try {
      // Validate content length
      if (this.content.original && this.content.original.length > 2000) {
        return next(new Error('Comment content too long'));
      }

      // Validate hierarchy level
      if (this.hierarchy.level > 3) {
        return next(new Error('Maximum nesting level exceeded'));
      }

      // Validate target consistency
      if (this.target.type === 'chapter' && !this.target.chapter_id) {
        return next(new Error('Chapter ID required for chapter comments'));
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Post-validate hook: Xử lý sau validation
   */
  schema.post('validate', function(doc, next) {
    // Mark as new for post-save hook
    if (this.isNew) {
      this.wasNew = true;
    }
    next();
  });

  /**
   * Index hooks: Ensure indexes are created
   */
  schema.post('init', function() {
    // This runs after the model is compiled
    // Indexes are already defined in schema.js
  });
};

module.exports = setupHooks;
