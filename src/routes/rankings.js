const express = require('express');
const router = express.Router();
const controller = require('../controllers/ranking/rankingController');
const { isAuthenticated: auth, isAdmin: adminOnly } = require('../middleware/auth');
const {
  validateRankingData,
  clearRankingCache,
  logRankingPerformance
} = require('../middleware/rankingMiddleware');

// Routes công khai với middleware
router.get('/daily', logRankingPerformance, validateRankingData, controller.getDailyRankings);
router.get('/weekly', logRankingPerformance, validateRankingData, controller.getWeeklyRankings);
router.get('/monthly', logRankingPerformance, validateRankingData, controller.getMonthlyRankings);
router.get('/all-time', logRankingPerformance, validateRankingData, controller.getAllTimeRankings);

// Route cưỡng chế cập nhật xếp hạng (chỉ dùng cho phát triển)
router.post('/force-update', clearRankingCache, controller.updateAllRankings);

// Route kiểm tra trạng thái ranking
router.get('/status', controller.checkRankingStatus);

// Routes admin (cần xác thực)
router.post('/update/daily', auth, adminOnly, controller.updateDailyRankings);
router.post('/update/weekly', auth, adminOnly, controller.updateWeeklyRankings);
router.post('/update/monthly', auth, adminOnly, controller.updateMonthlyRankings);
router.post('/update/all-time', auth, adminOnly, controller.updateAllTimeRankings);
router.post('/update/all', auth, adminOnly, controller.updateAllRankings);

module.exports = router;
