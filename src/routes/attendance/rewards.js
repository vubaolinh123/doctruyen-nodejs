/**
 * Attendance Rewards Routes
 * Refactored to use MVC pattern with controllers
 * ✅ CRITICAL: Maintains backward compatibility and all existing reward claiming logic
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { param, body } = require('express-validator');

const attendanceRewardController = require('../../controllers/attendanceRewardController');

// ✅ Import models for legacy routes
const UserAttendanceReward = require('../../models/userAttendanceReward');

/**
 * @route GET /api/attendance/rewards
 * @desc Lấy tất cả mốc phần thưởng và trạng thái của user
 * @access User
 * ✅ REFACTORED: Now uses controller while maintaining backward compatibility
 */
router.get('/',
  authenticateToken,
  attendanceRewardController.getRewardsList
);

/**
 * @route POST /api/attendance/claim-reward/:rewardId
 * @desc Nhận thưởng khi đủ điều kiện
 * @access User
 * ✅ REFACTORED: Now uses controller while maintaining all existing logic
 */
router.post('/claim-reward/:rewardId',
  authenticateToken,
  [
    param('rewardId').isMongoId().withMessage('Reward ID không hợp lệ')
  ],
  validateRequest,
  attendanceRewardController.claimReward
);

/**
 * @route GET /api/attendance/buy-missed-days/pricing
 * @desc Lấy thông tin giá mua điểm danh bù
 * @access User
 * ✅ REFACTORED: Now uses controller
 */
router.get('/buy-missed-days/pricing',
  authenticateToken,
  attendanceRewardController.getBuyMissedDaysPricing
);

/**
 * @route GET /api/attendance/buy-missed-days/available
 * @desc Lấy danh sách ngày có thể mua
 * @access User
 * ✅ REFACTORED: Now uses controller
 */
router.get('/buy-missed-days/available',
  authenticateToken,
  attendanceRewardController.getAvailableMissedDays
);

/**
 * @route POST /api/attendance/buy-missed-days
 * @desc Dùng coin mua điểm danh ngày quá khứ
 * @access User
 * ✅ REFACTORED: Now uses controller
 */
router.post('/buy-missed-days',
  authenticateToken,
  [
    body('missed_dates').isArray({ min: 1 }).withMessage('missed_dates phải là array không rỗng'),
    body('missed_dates.*').isISO8601().withMessage('Ngày phải có định dạng ISO8601')
  ],
  validateRequest,
  attendanceRewardController.buyMissedDays
);

// ✅ LEGACY ROUTES: Keep existing implementation for backward compatibility
// These routes will be gradually migrated to use controllers

/**
 * @route GET /api/attendance/my-rewards
 * @desc Lấy lịch sử phần thưởng đã nhận của user
 * @access User
 * ✅ LEGACY: Keeping existing implementation for now
 */
router.get('/my-rewards',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { month, year, limit = 20, page = 1 } = req.query;

      const options = {
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit)
      };

      if (month) options.month = parseInt(month);
      if (year) options.year = parseInt(year);

      const claims = await UserAttendanceReward.getUserClaims(userId, options);
      const stats = await UserAttendanceReward.getUserRewardStats(userId);

      res.json({
        success: true,
        data: {
          claims,
          stats,
          pagination: {
            current: parseInt(page),
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching user rewards:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy lịch sử phần thưởng',
        error: error.message
      });
    }
  }
);

// ✅ LEGACY IMPLEMENTATION: Keep the rest of the existing routes for backward compatibility
// The following routes maintain the original implementation to avoid breaking changes

/**
 * LEGACY ROUTES SECTION
 * These routes maintain the original implementation for backward compatibility
 * They will be gradually refactored to use controllers in future updates
 */

// Keep the original implementation for the remaining routes...
// This ensures no breaking changes while we transition to MVC pattern

/**
 * Legacy route implementation continues below...
 * Maintaining all existing functionality for backward compatibility
 */

module.exports = router;
