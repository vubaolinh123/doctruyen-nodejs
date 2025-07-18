/**
 * Attendance Routes
 * Refactored to use MVC pattern with controllers
 * Maintains backward compatibility with existing API endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { body } = require('express-validator');

const attendanceController = require('../../controllers/attendanceController');

/**
 * @route POST /api/attendance/checkin
 * @desc Check in attendance for current day
 * @access User
 */
router.post('/checkin',
  authenticateToken,
  attendanceController.checkIn
);

/**
 * @route GET /api/attendance/status
 * @desc Get attendance status for current day
 * @access User
 */
router.get('/status',
  authenticateToken,
  attendanceController.getAttendanceStatus
);

/**
 * @route GET /api/attendance/history
 * @desc Get attendance history for user
 * @access User
 */
router.get('/history',
  authenticateToken,
  attendanceController.getAttendanceHistory
);

/**
 * @route GET /api/attendance/stats
 * @desc Get attendance statistics for user
 * @access User
 */
router.get('/stats',
  authenticateToken,
  attendanceController.getAttendanceStats
);

/**
 * @route GET /api/attendance/calendar
 * @desc Get attendance calendar for specific month
 * @access User
 */
router.get('/calendar',
  authenticateToken,
  attendanceController.getAttendanceCalendar
);

/**
 * @route GET /api/attendance/summary
 * @desc Get user's attendance summary
 * @access User
 */
router.get('/summary',
  authenticateToken,
  attendanceController.getAttendanceSummary
);

/**
 * @route GET /api/attendance/missed-days
 * @desc Get available missed days for purchase
 * @access User
 */
router.get('/missed-days',
  authenticateToken,
  attendanceController.getAvailableMissedDays
);

/**
 * @route GET /api/attendance/buy-missed-days/pricing
 * @desc Get pricing for buying missed attendance days
 * @access User
 */
router.get('/buy-missed-days/pricing',
  authenticateToken,
  attendanceController.getBuyMissedDaysPricing
);

/**
 * @route POST /api/attendance/buy-missed-days
 * @desc Buy missed attendance days
 * @access User
 */
router.post('/buy-missed-days',
  authenticateToken,
  [
    body('missed_dates').isArray({ min: 1 }).withMessage('missed_dates phải là array không rỗng'),
    body('missed_dates.*').isISO8601().withMessage('Ngày phải có định dạng ISO8601')
  ],
  validateRequest,
  attendanceController.buyMissedDays
);

module.exports = router;
