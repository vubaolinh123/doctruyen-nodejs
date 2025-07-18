const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// Import author panel controllers
const dashboardController = require('../controllers/authorPanel/dashboardController');
const storiesController = require('../controllers/authorPanel/storiesController');
const chaptersController = require('../controllers/authorPanel/chaptersController');
const analyticsController = require('../controllers/authorPanel/analyticsController');
const revenueController = require('../controllers/authorPanel/revenueController');
const commentController = require('../controllers/authorPanel/commentController');
const readerAnalyticsController = require('../controllers/authorPanel/readerAnalyticsController');
const engagementController = require('../controllers/authorPanel/engagementController');

// Apply authentication and author role middleware to all routes
router.use(authenticateToken);
router.use(requireRole(['author', 'admin'])); // Allow both author and admin roles

// ============================================
// DASHBOARD ROUTES
// ============================================

// Get author dashboard overview data
router.get('/dashboard', dashboardController.getDashboardOverview);

// Get author profile and statistics
router.get('/profile', dashboardController.getAuthorProfile);

// Get recent activity feed
router.get('/activity', dashboardController.getRecentActivity);

// ============================================
// STORY MANAGEMENT ROUTES
// ============================================

// Get author's stories with pagination and filters
router.get('/stories', storiesController.getAuthorStories);

// Get author's draft stories with pagination and filters
router.get('/stories/drafts', storiesController.getAuthorDraftStories);

// Delete draft story (soft delete) - specific route for drafts
router.delete('/stories/drafts/:storyId', storiesController.deleteDraftStory);

// Get single story details for editing
router.get('/stories/:storyId', storiesController.getStoryDetails);

// Create new story
router.post('/stories', storiesController.createStory);

// Update existing story
router.put('/stories/:storyId', storiesController.updateStory);

// Delete story (soft delete)
router.delete('/stories/:storyId', storiesController.deleteStory);

// Resubmit rejected story for approval
router.post('/stories/:storyId/resubmit', storiesController.resubmitStoryForApproval);

// Get stories by approval status
router.get('/stories/approval/:approval_status', storiesController.getStoriesByApprovalStatus);

// Update story status (draft/published/completed)
router.patch('/stories/:storyId/status', storiesController.updateStoryStatus);

// Get story categories for dropdown
router.get('/stories/categories/list', storiesController.getCategories);

// ============================================
// CHAPTER MANAGEMENT ROUTES
// ============================================

// Get draft chapters across all stories (must be before parameterized routes)
router.get('/chapters/drafts', chaptersController.getDraftChapters);

// Get chapters for a specific story
router.get('/stories/:storyId/chapters', chaptersController.getStoryChapters);

// Get single chapter details for editing
router.get('/chapters/:chapterId', chaptersController.getChapterDetails);

// Create new chapter
router.post('/stories/:storyId/chapters', chaptersController.createChapter);

// Update existing chapter
router.put('/chapters/:chapterId', chaptersController.updateChapter);

// Delete chapter
router.delete('/chapters/:chapterId', chaptersController.deleteChapter);

// Update chapter status (draft/published/scheduled)
router.patch('/chapters/:chapterId/status', chaptersController.updateChapterStatus);

// Schedule chapter publication
router.post('/chapters/:chapterId/schedule', chaptersController.scheduleChapter);

// Auto-save chapter content (for draft saving)
router.post('/chapters/:chapterId/autosave', chaptersController.autoSaveChapter);

// Resubmit rejected chapter for approval
router.post('/chapters/:chapterId/resubmit', chaptersController.resubmitChapterForApproval);

// ============================================
// ANALYTICS ROUTES
// ============================================

// Get story analytics overview
router.get('/analytics/overview', analyticsController.getAnalyticsOverview);

// Get detailed story analytics
router.get('/analytics/stories/:storyId', analyticsController.getStoryAnalytics);

// Get chapter performance analytics
router.get('/analytics/chapters/:chapterId', analyticsController.getChapterAnalytics);

// Get reader engagement metrics
router.get('/analytics/engagement', analyticsController.getEngagementMetrics);

// Get view statistics with time range
router.get('/analytics/views', analyticsController.getViewStatistics);

// ============================================
// REVENUE & EARNINGS ROUTES
// ============================================

// Get revenue overview
router.get('/revenue/overview', revenueController.getRevenueOverview);

// Get detailed earnings by story
router.get('/revenue/stories', revenueController.getStoryEarnings);

// Get transaction history
router.get('/revenue/transactions', revenueController.getTransactionHistory);

// Get payout information
router.get('/revenue/payouts', revenueController.getPayoutInfo);

// Request payout
router.post('/revenue/payout-request', revenueController.requestPayout);

// ============================================
// READER ENGAGEMENT ROUTES
// ============================================

// Get comments on author's stories
router.get('/engagement/comments', engagementController.getStoryComments);

// Reply to comment
router.post('/engagement/comments/:commentId/reply', engagementController.replyToComment);

// Get story ratings and reviews
router.get('/engagement/ratings', engagementController.getStoryRatings);

// Get reader feedback and suggestions
router.get('/engagement/feedback', engagementController.getReaderFeedback);

// Get follower/subscriber information
router.get('/engagement/followers', engagementController.getFollowers);

// ============================================
// PUBLICATION & SCHEDULING ROUTES
// ============================================

// Get publication schedule
router.get('/publication/schedule', chaptersController.getPublicationSchedule);

// Bulk update chapter statuses
router.patch('/publication/bulk-update', chaptersController.bulkUpdateChapters);

// Get draft chapters
router.get('/publication/drafts', chaptersController.getDraftChapters);

// ============================================
// COMMENT MANAGEMENT ROUTES
// ============================================

// Get all comments for author's stories
router.get('/comments', commentController.getAuthorComments);

// Update comment status (approve, hide, delete)
router.put('/comments/:commentId/status', commentController.updateCommentStatus);

// Bulk update comments
router.post('/comments/bulk-update', commentController.bulkUpdateComments);

// ============================================
// READER ANALYTICS ROUTES
// ============================================

// Get reader engagement analytics
router.get('/analytics/readers', readerAnalyticsController.getReaderAnalytics);

// Get rating analytics
router.get('/analytics/ratings', readerAnalyticsController.getRatingAnalytics);

module.exports = router;
