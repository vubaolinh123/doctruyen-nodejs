const Notification = require('../models/notification');
const User = require('../models/user');

/**
 * Notification Service
 * Business logic for notification operations
 */
class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification(notificationData) {
    try {
      const notification = await Notification.createNotification(notificationData);
      return {
        success: true,
        data: notification.toClientFormat(),
        message: 'Notification created successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const result = await Notification.getForUser(userId, options);
      return {
        success: true,
        data: result.notifications,
        pagination: {
          total: result.total,
          hasMore: result.hasMore,
          limit: options.limit || 20,
          skip: options.skip || 0
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient_id: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.markAsRead();
      return {
        success: true,
        data: notification.toClientFormat(),
        message: 'Notification marked as read'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds, userId) {
    try {
      const result = await Notification.markMultipleAsRead(userId, notificationIds);
      return {
        success: true,
        data: { modifiedCount: result.modifiedCount },
        message: `${result.modifiedCount} notifications marked as read`
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.markAllAsRead(userId);
      return {
        success: true,
        data: { modifiedCount: result.modifiedCount },
        message: `${result.modifiedCount} notifications marked as read`
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    try {
      const count = await Notification.getUnreadCount(userId);
      return {
        success: true,
        data: { count },
        message: 'Unread count retrieved successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient_id: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.softDelete();
      return {
        success: true,
        message: 'Notification deleted successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Archive notification
   */
  async archiveNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient_id: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.archive();
      return {
        success: true,
        data: notification.toClientFormat(),
        message: 'Notification archived successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId, days = 30) {
    try {
      const stats = await Notification.getStats(userId, days);
      return {
        success: true,
        data: stats,
        message: 'Notification statistics retrieved successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create comment reply notification
   */
  async createCommentReplyNotification(replyData) {
    try {
      const { parentComment, replyComment, repliedBy } = replyData;

      // Don't notify if replying to own comment
      if (parentComment.user_id.toString() === repliedBy._id.toString()) {
        return { success: true, message: 'No notification needed for self-reply' };
      }

      const notificationData = {
        recipient_id: parentComment.user_id,
        type: 'comment_reply',
        title: 'Có phản hồi mới cho bình luận của bạn',
        message: `${repliedBy.name || 'Ai đó'} đã phản hồi bình luận của bạn`,
        data: {
          comment_id: replyComment._id,
          parent_comment_id: parentComment._id,
          story_id: replyComment.target.story_id,
          chapter_id: replyComment.target.chapter_id,
          sender_id: repliedBy._id
        },
        priority: 'normal'
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create comment like notification
   */
  async createCommentLikeNotification(likeData) {
    try {
      const { comment, likedBy } = likeData;

      // Don't notify if liking own comment
      if (comment.user_id.toString() === likedBy._id.toString()) {
        return { success: true, message: 'No notification needed for self-like' };
      }

      const notificationData = {
        recipient_id: comment.user_id,
        type: 'comment_like',
        title: 'Ai đó đã thích bình luận của bạn',
        message: `${likedBy.name || 'Ai đó'} đã thích bình luận của bạn`,
        data: {
          comment_id: comment._id,
          story_id: comment.target.story_id,
          chapter_id: comment.target.chapter_id,
          sender_id: likedBy._id
        },
        priority: 'low'
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create system announcement
   */
  async createSystemAnnouncement(announcementData) {
    try {
      const { title, message, targetUsers = 'all', priority = 'high' } = announcementData;

      let userIds = [];
      if (targetUsers === 'all') {
        // Get all active users
        const users = await User.find({ status: 'active' }, '_id');
        userIds = users.map(user => user._id);
      } else if (Array.isArray(targetUsers)) {
        userIds = targetUsers;
      }

      const notifications = userIds.map(userId => ({
        recipient_id: userId,
        type: 'system_announcement',
        title,
        message,
        priority,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      }));

      const result = await Notification.bulkCreate(notifications);
      return {
        success: true,
        data: { created: result.length },
        message: `System announcement sent to ${result.length} users`
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cleanup expired notifications
   */
  async cleanupExpiredNotifications() {
    try {
      const result = await Notification.cleanupExpired();
      return {
        success: true,
        data: { deletedCount: result.deletedCount },
        message: `${result.deletedCount} expired notifications cleaned up`
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new NotificationService();
