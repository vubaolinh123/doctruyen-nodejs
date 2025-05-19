const express = require('express');
const router = express.Router();
const controller = require('../controllers/ranking/rankingController');
const { isAuthenticated: auth, isAdmin: adminOnly } = require('../middleware/auth');

// Routes công khai
router.get('/daily', controller.getDailyRankings);
router.get('/weekly', controller.getWeeklyRankings);
router.get('/monthly', controller.getMonthlyRankings);
router.get('/all-time', controller.getAllTimeRankings);

// Route cưỡng chế cập nhật xếp hạng (chỉ dùng cho phát triển)
router.post('/force-update', controller.updateAllRankings);

// Routes admin (cần xác thực)
router.post('/update/daily', auth, adminOnly, controller.updateDailyRankings);
router.post('/update/weekly', auth, adminOnly, controller.updateWeeklyRankings);
router.post('/update/monthly', auth, adminOnly, controller.updateMonthlyRankings);
router.post('/update/all-time', auth, adminOnly, controller.updateAllTimeRankings);
router.post('/update/all', auth, adminOnly, controller.updateAllRankings);

module.exports = router;
