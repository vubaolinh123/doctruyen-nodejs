const express = require('express');
const router = express.Router();
const coinController = require('../controllers/coin/coinController');

/**
 * @route GET /api/admin/coins/stats
 * @desc Lấy thống kê xu
 * @access Private (Admin)
 */
router.get('/stats', coinController.getStats);

/**
 * @route GET /api/admin/coins/chart
 * @desc Lấy dữ liệu biểu đồ xu
 * @access Private (Admin)
 */
router.get('/chart', coinController.getChart);

/**
 * @route POST /api/admin/coins/manage
 * @desc Quản lý xu của người dùng
 * @access Private (Admin)
 */
router.post('/manage', coinController.manageCoins);

/**
 * @route POST /api/admin/coins/check-consistency
 * @desc Kiểm tra tính nhất quán của dữ liệu xu
 * @access Private (Admin)
 */
router.post('/check-consistency', coinController.checkConsistency);

/**
 * @route POST /api/admin/coins/repair
 * @desc Sửa chữa dữ liệu xu không nhất quán
 * @access Private (Admin)
 */
router.post('/repair', coinController.repairData);

/**
 * @route GET /api/admin/coins/transactions
 * @desc Lấy lịch sử giao dịch xu của người dùng
 * @access Private (Admin)
 */
router.get('/transactions', coinController.getTransactions);

/**
 * @route POST /api/admin/coins/repair-coins
 * @desc Sửa chữa số dư xu của người dùng
 * @access Private (Admin)
 */
router.post('/repair-coins', coinController.repairCoins);

module.exports = router;
