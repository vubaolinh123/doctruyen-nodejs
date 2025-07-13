/**
 * Admin Mission Management Routes
 * Handles admin operations for mission management
 */

const express = require('express');
const router = express.Router();
const missionController = require('../../controllers/admin/missionController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// Apply authentication and admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/missions/users
 * Get paginated list of users with mission statistics
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10)
 * - search: Search by name or email
 * - sortBy: Sort field (default: createdAt)
 * - sortOrder: Sort order (asc/desc, default: desc)
 */
router.get('/users', missionController.getUsersWithMissionStats);

/**
 * GET /api/admin/missions/users/search
 * Search users for mission management
 * Query params:
 * - query: Search query (name or email)
 * - limit: Max results (default: 10)
 */
router.get('/users/search', missionController.searchUsers);

/**
 * GET /api/admin/missions/user/:userId
 * Get detailed mission data for specific user
 * Params:
 * - userId: User ID
 */
router.get('/user/:userId', missionController.getUserMissionDetails);

/**
 * POST /api/admin/missions/user/:userId/complete
 * Force complete specific mission for user
 * Params:
 * - userId: User ID
 * Body:
 * - missionId: Mission ID to complete
 */
router.post('/user/:userId/complete', missionController.forceCompleteMission);

/**
 * POST /api/admin/missions/user/:userId/reset
 * Reset specific mission or all missions by type for user
 * Params:
 * - userId: User ID
 * Body:
 * - missionId: Specific mission ID to reset (optional)
 * - type: Mission type to reset all (daily/weekly, optional)
 * Note: Either missionId or type must be provided
 */
router.post('/user/:userId/reset', missionController.resetUserMissions);

/**
 * POST /api/admin/missions/bulk/reset
 * Bulk reset missions for all users
 * Body:
 * - type: Mission type to reset (daily/weekly)
 */
router.post('/bulk/reset', missionController.bulkResetMissions);

module.exports = router;
