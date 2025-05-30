const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * Notification Routes
 * All routes require authentication
 */

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications with pagination and filtering
 * @access  Private
 * @query   {string} status - Filter by status (unread, read, archived)
 * @query   {string} type - Filter by notification type
 * @query   {string} category - Filter by category (social, content, system, achievement, moderation)
 * @query   {number} limit - Number of notifications per page (default: 20)
 * @query   {number} skip - Number of notifications to skip (default: 0)
 * @query   {string} sort - Sort field (default: created_at)
 */
router.get('/', notificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count for user
 * @access  Private
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics for user
 * @access  Private
 * @query   {number} days - Number of days to include in stats (default: 30)
 */
router.get('/stats', notificationController.getStats);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark specific notification as read
 * @access  Private
 * @param   {string} id - Notification ID
 */
router.put('/:id/read', notificationController.markAsRead);

/**
 * @route   PUT /api/notifications/:id/archive
 * @desc    Archive specific notification
 * @access  Private
 * @param   {string} id - Notification ID
 */
router.put('/:id/archive', notificationController.archiveNotification);

/**
 * @route   PUT /api/notifications/mark-read
 * @desc    Mark multiple notifications as read
 * @access  Private
 * @body    {string[]} notificationIds - Array of notification IDs
 */
router.put('/mark-read', notificationController.markMultipleAsRead);

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all user notifications as read
 * @access  Private
 */
router.put('/mark-all-read', notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete specific notification
 * @access  Private
 * @param   {string} id - Notification ID
 */
router.delete('/:id', notificationController.deleteNotification);

/**
 * Admin-only routes
 */

/**
 * @route   POST /api/notifications/announcement
 * @desc    Create system announcement (Admin only)
 * @access  Private (Admin)
 * @body    {string} title - Announcement title
 * @body    {string} message - Announcement message
 * @body    {string|string[]} targetUsers - Target users ('all' or array of user IDs)
 * @body    {string} priority - Priority level (low, normal, high, urgent)
 */
router.post('/announcement', requireAdmin, notificationController.createAnnouncement);

/**
 * @route   POST /api/notifications/cleanup
 * @desc    Cleanup expired notifications (Admin only)
 * @access  Private (Admin)
 */
router.post('/cleanup', requireAdmin, notificationController.cleanupExpired);

module.exports = router;
