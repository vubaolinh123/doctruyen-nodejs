const Notification = require('../../models/notification');
const User = require('../../models/user');

/**
 * Admin Notification Service
 * Handles notifications for admin actions
 */
class AdminNotificationService {
  /**
   * Send notification when admin deletes a comment
   * @param {Object} params - Notification parameters
   * @param {String} params.adminId - ID of admin who performed the action
   * @param {String} params.targetUserId - ID of user whose comment was deleted
   * @param {String} params.commentId - ID of the deleted comment
   * @param {String} params.reason - Reason for deletion
   * @param {String} params.storyId - ID of the story (optional)
   * @param {String} params.chapterId - ID of the chapter (optional)
   * @returns {Promise<Object>} - Notification result
   */
  async sendCommentDeletionNotification({
    adminId,
    targetUserId,
    commentId,
    reason,
    storyId = null,
    chapterId = null
  }) {
    try {
      // Don't send notification if admin deleted their own comment
      if (adminId.toString() === targetUserId.toString()) {
        return { success: true, message: 'No notification needed for self-deletion' };
      }

      // Get admin info
      const admin = await User.findById(adminId).select('name role');
      if (!admin || admin.role !== 'admin') {
        throw new Error('Invalid admin user');
      }

      // Create notification
      const notification = new Notification({
        recipient_id: targetUserId,
        type: 'admin_comment_deletion',
        title: 'Bình luận của bạn đã bị xóa bởi Admin',
        message: `Admin ${admin.name} đã xóa bình luận của bạn. Lý do: ${reason}`,
        data: {
          admin_id: adminId,
          admin_name: admin.name,
          comment_id: commentId,
          deletion_reason: reason,
          story_id: storyId,
          chapter_id: chapterId,
          action_type: 'comment_deletion'
        },
        metadata: {
          priority: 'high',
          category: 'moderation',
          requires_acknowledgment: true
        }
      });

      await notification.save();

      // Log admin action
      console.log(`[ADMIN NOTIFICATION] Comment deletion notification sent:`, {
        admin: admin.name,
        adminId,
        targetUserId,
        commentId,
        reason,
        notificationId: notification._id
      });

      return {
        success: true,
        message: 'Admin deletion notification sent successfully',
        notificationId: notification._id
      };

    } catch (error) {
      console.error('[AdminNotificationService] Error sending comment deletion notification:', error);
      throw error;
    }
  }

  /**
   * Send notification when admin performs bulk actions
   * @param {Object} params - Notification parameters
   * @param {String} params.adminId - ID of admin who performed the action
   * @param {Array} params.targetUserIds - Array of user IDs affected
   * @param {String} params.actionType - Type of bulk action
   * @param {String} params.reason - Reason for action
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} - Notification result
   */
  async sendBulkActionNotification({
    adminId,
    targetUserIds,
    actionType,
    reason,
    metadata = {}
  }) {
    try {
      // Get admin info
      const admin = await User.findById(adminId).select('name role');
      if (!admin || admin.role !== 'admin') {
        throw new Error('Invalid admin user');
      }

      const notifications = [];

      for (const targetUserId of targetUserIds) {
        // Skip if admin is targeting themselves
        if (adminId.toString() === targetUserId.toString()) {
          continue;
        }

        const notification = new Notification({
          recipient_id: targetUserId,
          type: `admin_bulk_${actionType}`,
          title: `Hành động hàng loạt từ Admin`,
          message: `Admin ${admin.name} đã thực hiện hành động: ${actionType}. Lý do: ${reason}`,
          data: {
            admin_id: adminId,
            admin_name: admin.name,
            action_type: actionType,
            reason: reason,
            ...metadata
          },
          metadata: {
            priority: 'high',
            category: 'moderation',
            requires_acknowledgment: true
          }
        });

        await notification.save();
        notifications.push(notification._id);
      }

      // Log admin action
      console.log(`[ADMIN NOTIFICATION] Bulk action notifications sent:`, {
        admin: admin.name,
        adminId,
        actionType,
        targetCount: notifications.length,
        reason
      });

      return {
        success: true,
        message: `Bulk action notifications sent to ${notifications.length} users`,
        notificationIds: notifications
      };

    } catch (error) {
      console.error('[AdminNotificationService] Error sending bulk action notification:', error);
      throw error;
    }
  }

  /**
   * Log admin action for audit purposes
   * @param {Object} params - Action parameters
   * @param {String} params.adminId - ID of admin who performed the action
   * @param {String} params.action - Action performed
   * @param {String} params.targetType - Type of target (comment, user, story, etc.)
   * @param {String} params.targetId - ID of target
   * @param {String} params.reason - Reason for action
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async logAdminAction({
    adminId,
    action,
    targetType,
    targetId,
    reason,
    metadata = {}
  }) {
    try {
      const admin = await User.findById(adminId).select('name role');
      if (!admin) {
        throw new Error('Admin user not found');
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        admin: {
          id: adminId,
          name: admin.name,
          role: admin.role
        },
        action,
        target: {
          type: targetType,
          id: targetId
        },
        reason,
        metadata,
        ip: metadata.ip || 'unknown',
        userAgent: metadata.userAgent || 'unknown'
      };

      // Log to console with Vietnam timezone
      const vietnamTime = new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      console.log(`[${vietnamTime}] [ADMIN ACTION] ${admin.name} (${adminId}) performed ${action} on ${targetType} ${targetId}. Reason: ${reason}`);

      // TODO: Store in dedicated admin action log collection if needed
      // const AdminActionLog = require('../../models/adminActionLog');
      // await AdminActionLog.create(logEntry);

    } catch (error) {
      console.error('[AdminNotificationService] Error logging admin action:', error);
      // Don't throw error for logging failures to avoid breaking main functionality
    }
  }

  /**
   * Get admin action history for audit
   * @param {Object} filters - Filter parameters
   * @param {String} filters.adminId - Filter by admin ID
   * @param {String} filters.action - Filter by action type
   * @param {String} filters.targetType - Filter by target type
   * @param {Date} filters.startDate - Filter by start date
   * @param {Date} filters.endDate - Filter by end date
   * @param {Number} filters.limit - Limit results
   * @returns {Promise<Array>} - Action history
   */
  async getAdminActionHistory(filters = {}) {
    try {
      // TODO: Implement when AdminActionLog model is created
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('[AdminNotificationService] Error getting admin action history:', error);
      throw error;
    }
  }
}

module.exports = new AdminNotificationService();
