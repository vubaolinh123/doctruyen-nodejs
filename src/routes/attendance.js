const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance');
const { authenticateToken } = require('../middleware/auth');

// Lấy lịch sử điểm danh theo tháng
router.get('/', authenticateToken, attendanceController.getAttendanceHistory);

// Điểm danh hàng ngày
router.post('/', authenticateToken, attendanceController.checkIn);

module.exports = router;
