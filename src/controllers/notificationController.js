const notificationService = require('../services/notificationService');
const { authUtils } = require('../utils');

/**
 * Notification Controller
 * HTTP request handlers for notification operations
 */
class NotificationController {
  /**
   * Get user notifications
   * GET /api/notifications
   */
  async getNotifications(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const {
        status,
        type,
        category,
        limit = 20,
        skip = 0,
        sort = 'created_at'
      } = req.query;

      const options = {
        status,
        type,
        category,
        limit: parseInt(limit),
        skip: parseInt(skip),
        sort: { [sort]: -1 }
      };

      const result = await notificationService.getUserNotifications(userId, options);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách thông báo',
        error: error.message
      });
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const result = await notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể lấy số thông báo chưa đọc',
        error: error.message
      });
    }
  }

  /**
   * Mark notification as read
   * PUT /api/notifications/:id/read
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id || req.user.id;

      const result = await notificationService.markAsRead(id, userId);

      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể đánh dấu thông báo đã đọc',
        error: error.message
      });
    }
  }

  /**
   * Mark multiple notifications as read
   * PUT /api/notifications/mark-read
   */
  async markMultipleAsRead(req, res) {
    try {
      const { notificationIds } = req.body;
      const userId = req.user._id || req.user.id;

      if (!Array.isArray(notificationIds)) {
        return res.status(400).json({
          success: false,
          message: 'notificationIds phải là một mảng'
        });
      }

      const result = await notificationService.markMultipleAsRead(notificationIds, userId);

      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } catch (error) {
      console.error('Error marking multiple notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể đánh dấu thông báo đã đọc',
        error: error.message
      });
    }
  }

  /**
   * Mark all notifications as read
   * PUT /api/notifications/mark-all-read
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const result = await notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể đánh dấu tất cả thông báo đã đọc',
        error: error.message
      });
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id || req.user.id;

      const result = await notificationService.deleteNotification(id, userId);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể xóa thông báo',
        error: error.message
      });
    }
  }

  /**
   * Archive notification
   * PUT /api/notifications/:id/archive
   */
  async archiveNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id || req.user.id;

      const result = await notificationService.archiveNotification(id, userId);

      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } catch (error) {
      console.error('Error archiving notification:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể lưu trữ thông báo',
        error: error.message
      });
    }
  }

  /**
   * Get notification statistics
   * GET /api/notifications/stats
   */
  async getStats(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { days = 30 } = req.query;

      const result = await notificationService.getNotificationStats(userId, parseInt(days));

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      console.error('Error getting notification stats:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể lấy thống kê thông báo',
        error: error.message
      });
    }
  }

  /**
   * Create system announcement (Admin only)
   * POST /api/notifications/announcement
   */
  async createAnnouncement(req, res) {
    try {
      // Check admin permission
      if (!authUtils.isAdminRole(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Không có quyền tạo thông báo hệ thống'
        });
      }

      const { title, message, targetUsers, priority } = req.body;

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Tiêu đề và nội dung thông báo là bắt buộc'
        });
      }

      const result = await notificationService.createSystemAnnouncement({
        title,
        message,
        targetUsers,
        priority
      });

      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể tạo thông báo hệ thống',
        error: error.message
      });
    }
  }

  /**
   * Cleanup expired notifications (Admin only)
   * POST /api/notifications/cleanup
   */
  async cleanupExpired(req, res) {
    try {
      // Check admin permission
      if (!authUtils.isAdminRole(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Không có quyền dọn dẹp thông báo'
        });
      }

      const result = await notificationService.cleanupExpiredNotifications();

      res.json({
        success: true,
        data: result.data,
        message: result.message
      });
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể dọn dẹp thông báo hết hạn',
        error: error.message
      });
    }
  }
}

module.exports = new NotificationController();
