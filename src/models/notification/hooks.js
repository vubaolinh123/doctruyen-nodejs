/**
 * Notification Model Hooks
 * Pre/post hooks for notification lifecycle events
 */

const setupHooks = (schema) => {
  /**
   * Pre-save hook: Validation and data processing
   */
  schema.pre('save', async function(next) {
    try {
      // Set updated_at timestamp
      this.updated_at = new Date();

      // Auto-generate URL if not provided
      if (!this.url && this.data) {
        this.url = generateNotificationUrl(this.type, this.data);
      }

      // Set priority based on type if not specified
      if (!this.priority) {
        this.priority = getDefaultPriority(this.type);
      }

      // Validate recipient exists
      if (this.isNew) {
        const User = require('../user');
        const userExists = await User.findById(this.recipient_id);
        if (!userExists) {
          throw new Error('Recipient user not found');
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Post-save hook: Trigger delivery and real-time updates
   */
  schema.post('save', async function(doc, next) {
    try {
      // Only trigger for new notifications
      if (doc.wasNew || this.isNew) {
        // Trigger real-time notification (WebSocket)
        await triggerRealTimeNotification(doc);

        // Queue email/push notifications if enabled
        await queueExternalNotifications(doc);

        // Update user notification stats
        await updateUserNotificationStats(doc.recipient_id);
      }

      next();
    } catch (error) {
      console.error('Error in notification post-save hook:', error);
      next();
    }
  });

  /**
   * Pre-remove hook: Cleanup related data
   */
  schema.pre('remove', async function(next) {
    try {
      // Update user notification stats
      await updateUserNotificationStats(this.recipient_id);
      next();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Post-validate hook: Mark as new for post-save hook
   */
  schema.post('validate', function(doc, next) {
    if (this.isNew) {
      this.wasNew = true;
    }
    next();
  });
};

/**
 * Helper Functions
 */

// Generate notification URL based on type and data
function generateNotificationUrl(type, data) {
  const urlMap = {
    'comment_reply': () => {
      if (data.story_id && data.chapter_id) {
        return `/story/${data.story_id}/chapter/${data.chapter_id}#comment-${data.comment_id}`;
      } else if (data.story_id) {
        return `/story/${data.story_id}#comment-${data.comment_id}`;
      }
      return `/comments/${data.comment_id}`;
    },
    'comment_like': () => {
      if (data.story_id && data.chapter_id) {
        return `/story/${data.story_id}/chapter/${data.chapter_id}#comment-${data.comment_id}`;
      } else if (data.story_id) {
        return `/story/${data.story_id}#comment-${data.comment_id}`;
      }
      return `/comments/${data.comment_id}`;
    },
    'story_update': () => `/story/${data.story_id}`,
    'story_like': () => `/story/${data.story_id}`,
    'story_follow': () => `/story/${data.story_id}`,
    'chapter_release': () => `/story/${data.story_id}/chapter/${data.chapter_id}`,
    'user_follow': () => `/profile/${data.sender_id}`,
    'achievement_unlock': () => `/profile/achievements`,
    'reward_received': () => `/profile/rewards`,
    'attendance_reminder': () => `/profile/attendance`,
    'system_announcement': () => `/announcements`,
    'moderation_action': () => `/profile/moderation`,
    'admin_message': () => `/messages`
  };

  const generator = urlMap[type];
  return generator ? generator() : '/notifications';
}

// Get default priority based on notification type
function getDefaultPriority(type) {
  const priorityMap = {
    'system_announcement': 'high',
    'moderation_action': 'high',
    'admin_message': 'high',
    'achievement_unlock': 'normal',
    'reward_received': 'normal',
    'story_update': 'normal',
    'chapter_release': 'normal',
    'comment_reply': 'normal',
    'comment_like': 'low',
    'story_like': 'low',
    'story_follow': 'low',
    'user_follow': 'low',
    'attendance_reminder': 'low'
  };

  return priorityMap[type] || 'normal';
}

// Trigger real-time notification via WebSocket
async function triggerRealTimeNotification(notification) {
  try {
    // TODO: Implement WebSocket notification
    // This would integrate with Socket.IO or similar
    console.log(`[Notification] Real-time notification triggered for user ${notification.recipient_id}`);
    
    // For now, just log the notification
    // In future implementation:
    // const io = require('../../services/socketService');
    // io.to(`user_${notification.recipient_id}`).emit('notification', notification.toClientFormat());
  } catch (error) {
    console.error('Error triggering real-time notification:', error);
  }
}

// Queue external notifications (email/push)
async function queueExternalNotifications(notification) {
  try {
    // Queue email notification if enabled
    if (notification.delivery.email.enabled) {
      // TODO: Implement email queue
      console.log(`[Notification] Email notification queued for user ${notification.recipient_id}`);
      // const emailQueue = require('../../services/emailQueue');
      // await emailQueue.add('notification', { notificationId: notification._id });
    }

    // Queue push notification if enabled
    if (notification.delivery.push.enabled) {
      // TODO: Implement push notification queue
      console.log(`[Notification] Push notification queued for user ${notification.recipient_id}`);
      // const pushQueue = require('../../services/pushQueue');
      // await pushQueue.add('notification', { notificationId: notification._id });
    }
  } catch (error) {
    console.error('Error queuing external notifications:', error);
  }
}

// Update user notification statistics
async function updateUserNotificationStats(userId) {
  try {
    const User = require('../user');
    const Notification = require('./index');

    const unreadCount = await Notification.getUnreadCount(userId);
    
    await User.findByIdAndUpdate(userId, {
      $set: {
        'notification_stats.unread_count': unreadCount,
        'notification_stats.last_updated': new Date()
      }
    });
  } catch (error) {
    console.error('Error updating user notification stats:', error);
  }
}

module.exports = setupHooks;
