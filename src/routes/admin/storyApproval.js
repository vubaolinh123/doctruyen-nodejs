const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth.middleware');
const storyApprovalController = require('../../controllers/admin/storyApprovalController');
const chapterApprovalController = require('../../controllers/admin/chapterApprovalController');

// Apply authentication and admin role middleware to all routes
router.use(authenticateToken);
router.use(requireRole(['admin'])); // Admin only

// ============================================
// STORY APPROVAL ROUTES
// ============================================

// Get stories pending approval with pagination and filters
// GET /api/admin/stories/approval?approval_status=pending&page=1&limit=20
router.get('/stories/approval', storyApprovalController.getPendingStories);

// Approve or reject a specific story
// PUT /api/admin/stories/:storyId/approval
// Body: { "approval_status": "approved" | "rejected", "rejection_reason"?: string }
router.put('/stories/:storyId/approval', storyApprovalController.updateStoryApproval);

// Get story approval statistics and recent activities
// GET /api/admin/stories/approval/stats
router.get('/stories/approval/stats', storyApprovalController.getApprovalStats);

// ============================================
// CHAPTER APPROVAL ROUTES
// ============================================

// Get stories with pending draft chapters for approval
// GET /api/admin/chapters/approval?page=1&limit=20
router.get('/chapters/approval', chapterApprovalController.getStoriesWithPendingChapters);

// Get pending chapters for a specific story
// GET /api/admin/chapters/approval/story/:storyId?page=1&limit=50
router.get('/chapters/approval/story/:storyId', chapterApprovalController.getPendingChaptersByStory);

// Approve or reject a chapter
// PUT /api/admin/chapters/:chapterId/approval
router.put('/chapters/:chapterId/approval', chapterApprovalController.updateChapterApproval);

// Get chapter approval statistics
// GET /api/admin/chapters/approval/stats
router.get('/chapters/approval/stats', chapterApprovalController.getChapterApprovalStats);

module.exports = router;
