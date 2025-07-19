/**
 * Revenue Analytics Routes for Author Panel
 * Handles revenue analytics and reporting endpoints
 */

const express = require('express');
const router = express.Router();
const revenueController = require('../../controllers/authorPanel/revenueAnalyticsController');
const { authenticateToken } = require('../../middleware/auth');
const { authorizeAuthor } = require('../../middleware/authorAuth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/author-panel/revenue/overview
 * @desc    Get revenue overview for authenticated author
 * @access  Private (Author/Admin)
 * @query   {string} period - Time period (7d, 30d, 90d, 1y, all)
 * @query   {string} startDate - Custom start date (ISO string)
 * @query   {string} endDate - Custom end date (ISO string)
 * @query   {string} authorId - Author ID (admin only)
 */
router.get('/overview', revenueController.getRevenueOverview);

/**
 * @route   GET /api/author-panel/revenue/stories/:storyId
 * @desc    Get revenue details for a specific story
 * @access  Private (Author/Admin)
 * @param   {string} storyId - Story ID
 * @query   {string} period - Time period (7d, 30d, 90d, 1y, all)
 * @query   {string} startDate - Custom start date (ISO string)
 * @query   {string} endDate - Custom end date (ISO string)
 * @query   {string} authorId - Author ID (admin only)
 */
router.get('/stories/:storyId', revenueController.getStoryRevenue);

/**
 * @route   GET /api/author-panel/revenue/transactions
 * @desc    Get transaction history for authenticated author
 * @access  Private (Author/Admin)
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 20, max: 100)
 * @query   {string} period - Time period (7d, 30d, 90d, 1y, all)
 * @query   {string} startDate - Custom start date (ISO string)
 * @query   {string} endDate - Custom end date (ISO string)
 * @query   {string} storyId - Filter by story ID
 * @query   {string} transactionType - Filter by type (story, chapter)
 * @query   {string} authorId - Author ID (admin only)
 */
router.get('/transactions', revenueController.getTransactionHistory);

module.exports = router;
