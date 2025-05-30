/**
 * Notification Model Methods
 * Instance and static methods for notification operations
 */

const setupMethods = (schema) => {
  /**
   * Instance Methods
   */

  // Mark notification as read
  schema.methods.markAsRead = function() {
    this.status = 'read';
    this.interactions.read_at = new Date();
    this.delivery.in_app.delivered = true;
    this.delivery.in_app.delivered_at = new Date();
    return this.save();
  };

  // Mark notification as clicked
  schema.methods.markAsClicked = function(actionTaken = null) {
    this.interactions.clicked_at = new Date();
    if (actionTaken) {
      this.interactions.action_taken = actionTaken;
    }
    if (this.status === 'unread') {
      this.status = 'read';
      this.interactions.read_at = new Date();
    }
    return this.save();
  };

  // Archive notification
  schema.methods.archive = function() {
    this.status = 'archived';
    return this.save();
  };

  // Soft delete notification
  schema.methods.softDelete = function() {
    this.status = 'deleted';
    return this.save();
  };

  // Check if notification is expired
  schema.methods.isExpired = function() {
    return this.expires_at && this.expires_at < new Date();
  };

  // Get formatted notification data for frontend
  schema.methods.toClientFormat = function() {
    return {
      _id: this._id,
      type: this.type,
      category: this.category,
      title: this.title,
      message: this.message,
      data: this.data,
      url: this.url,
      action_url: this.action_url,
      status: this.status,
      priority: this.priority,
      created_at: this.created_at,
      read_at: this.interactions.read_at,
      clicked_at: this.interactions.clicked_at,
      is_expired: this.isExpired()
    };
  };

  /**
   * Static Methods
   */

  // Create notification with automatic delivery setup
  schema.statics.createNotification = async function(notificationData) {
    try {
      // Set default expiration (30 days for most notifications)
      if (!notificationData.expires_at) {
        const expirationMap = {
          'system_announcement': 90, // 90 days
          'achievement_unlock': 365, // 1 year
          'reward_received': 365, // 1 year
          'moderation_action': 180, // 6 months
          'admin_message': 180 // 6 months
        };
        
        const days = expirationMap[notificationData.type] || 30;
        notificationData.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }

      // Set delivery preferences based on user settings
      const User = require('../user');
      const user = await User.findById(notificationData.recipient_id);
      
      if (user && user.notification_preferences) {
        const prefs = user.notification_preferences;
        notificationData.delivery = {
          in_app: { delivered: false },
          email: { 
            enabled: prefs.email && prefs.types.includes(notificationData.type),
            delivered: false 
          },
          push: { 
            enabled: prefs.push && prefs.types.includes(notificationData.type),
            delivered: false 
          }
        };
      }

      const notification = new this(notificationData);
      await notification.save();

      // Mark in-app as delivered immediately
      notification.delivery.in_app.delivered = true;
      notification.delivery.in_app.delivered_at = new Date();
      await notification.save();

      return notification;
    } catch (error) {
      throw error;
    }
  };

  // Get notifications for user with pagination
  schema.statics.getForUser = async function(userId, options = {}) {
    const {
      status = null,
      type = null,
      category = null,
      limit = 20,
      skip = 0,
      sort = { created_at: -1 }
    } = options;

    const query = { 
      recipient_id: userId,
      status: { $ne: 'deleted' }
    };

    if (status) query.status = status;
    if (type) query.type = type;
    if (category) query.category = category;

    const notifications = await this.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .populate('data.sender_id', 'name avatar slug')
      .populate('data.story_id', 'title slug')
      .populate('data.chapter_id', 'title chapter_number');

    const total = await this.countDocuments(query);

    return {
      notifications: notifications.map(n => n.toClientFormat()),
      total,
      hasMore: skip + limit < total
    };
  };

  // Mark multiple notifications as read
  schema.statics.markMultipleAsRead = async function(userId, notificationIds) {
    const result = await this.updateMany(
      {
        _id: { $in: notificationIds },
        recipient_id: userId,
        status: 'unread'
      },
      {
        $set: {
          status: 'read',
          'interactions.read_at': new Date(),
          'delivery.in_app.delivered': true,
          'delivery.in_app.delivered_at': new Date()
        }
      }
    );

    return result;
  };

  // Mark all notifications as read for user
  schema.statics.markAllAsRead = async function(userId) {
    const result = await this.updateMany(
      {
        recipient_id: userId,
        status: 'unread'
      },
      {
        $set: {
          status: 'read',
          'interactions.read_at': new Date(),
          'delivery.in_app.delivered': true,
          'delivery.in_app.delivered_at': new Date()
        }
      }
    );

    return result;
  };

  // Get unread count for user
  schema.statics.getUnreadCount = async function(userId) {
    return await this.countDocuments({
      recipient_id: userId,
      status: 'unread'
    });
  };

  // Clean up expired notifications
  schema.statics.cleanupExpired = async function() {
    const result = await this.deleteMany({
      expires_at: { $lt: new Date() }
    });

    return result;
  };

  // Get notification statistics
  schema.statics.getStats = async function(userId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await this.aggregate([
      {
        $match: {
          recipient_id: userId,
          created_at: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$status', 'unread'] }, 1, 0] }
          }
        }
      }
    ]);

    return stats;
  };

  // Bulk create notifications (for system announcements)
  schema.statics.bulkCreate = async function(notifications) {
    try {
      const result = await this.insertMany(notifications, { ordered: false });
      return result;
    } catch (error) {
      throw error;
    }
  };
};

module.exports = setupMethods;
