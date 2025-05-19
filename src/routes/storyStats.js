const express = require('express');
const router = express.Router();
const statsController = require('../controllers/storyStats/storyStatsController');
const ratingController = require('../controllers/storyStats');
const auth = require('../middleware/auth');

// Lấy tổng lượt xem của một truyện
router.get('/views/:storyId', statsController.getTotalViews);

// Lấy lượt xem của một truyện trong một khoảng thời gian
router.get('/views/:storyId/time-range', statsController.getViewsByTimeRange);

// Lấy thống kê đánh giá của một truyện
router.get('/ratings/:storyId', statsController.getRatingStats);

// Đánh giá truyện (yêu cầu đăng nhập)
router.post('/ratings', auth, ratingController.rateStory);

// Lấy đánh giá của người dùng cho truyện (yêu cầu đăng nhập)
router.get('/ratings/user/:storyId', auth, ratingController.getUserRating);

module.exports = router;
