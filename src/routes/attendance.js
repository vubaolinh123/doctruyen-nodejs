const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance');
const { authenticateToken } = require('../middleware/auth');

// Lấy lịch sử điểm danh theo tháng - sử dụng controller mới đã được refactor
router.get('/', authenticateToken, attendanceController.getAttendanceHistory);

// Điểm danh hàng ngày - sử dụng controller mới đã được refactor
router.post('/', authenticateToken, attendanceController.checkIn);

// Routes cho phần thưởng điểm danh
router.use('/rewards', require('./attendance/rewards'));

module.exports = router;
