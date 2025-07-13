const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance');
const { authenticateToken } = require('../middleware/auth');
const { param } = require('express-validator');
const { validateRequest } = require('../middleware/validation');

// Lấy lịch sử điểm danh theo tháng - sử dụng controller mới đã được refactor
router.get('/', authenticateToken, attendanceController.getAttendanceHistory);

// Điểm danh hàng ngày - sử dụng controller mới đã được refactor
router.post('/', authenticateToken, attendanceController.checkIn);

// User milestone progress endpoint
router.get('/milestones/progress',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // Import models
      const User = require('../models/user');
      const AttendanceMilestone = require('../models/attendanceReward'); // AttendanceMilestone model
      const UserAttendanceMilestone = require('../models/userAttendanceReward'); // UserAttendanceMilestone model
      const Transaction = require('../models/transaction'); // For transaction logging

      // Get user details
      const user = await User.findById(userId).lean();
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Get milestone achievements
      const milestoneAchievements = await UserAttendanceMilestone.find({
        user_id: userId
      }).populate('milestone_id', 'title type required_days reward_type reward_value')
        .sort({ claimed_at: -1 })
        .lean();

      // Get available milestones for progress tracking
      const availableMilestones = await AttendanceMilestone.find({
        is_active: true
      }).sort({ type: 1, required_days: 1 }).lean();

      // Calculate milestone progress
      const milestoneProgress = availableMilestones.map(milestone => {
        const isAchieved = milestoneAchievements.some(achievement =>
          achievement.milestone_id._id.toString() === milestone._id.toString() &&
          (milestone.type === 'lifetime' ||
           (milestone.type === 'monthly' &&
            achievement.month === currentMonth &&
            achievement.year === currentYear))
        );

        let currentProgress = 0;
        if (milestone.type === 'monthly') {
          currentProgress = user.attendance_summary?.monthly_days || 0;
        } else {
          currentProgress = user.attendance_summary?.total_days || 0;
        }

        return {
          ...milestone,
          current_progress: currentProgress,
          is_achieved: isAchieved,
          progress_percentage: Math.min((currentProgress / milestone.required_days) * 100, 100),
          claimed: isAchieved,
          canClaim: currentProgress >= milestone.required_days && !isAchieved
        };
      });

      // Separate monthly and lifetime milestones
      const monthlyMilestones = milestoneProgress.filter(m => m.type === 'monthly');
      const lifetimeMilestones = milestoneProgress.filter(m => m.type === 'lifetime');

      res.json({
        success: true,
        data: {
          userStats: {
            monthly_days: user.attendance_summary?.monthly_days || 0,
            total_days: user.attendance_summary?.total_days || 0,
            current_month: currentMonth,
            current_year: currentYear,
            current_streak: user.attendance_summary?.current_streak || 0,
            longest_streak: user.attendance_summary?.longest_streak || 0,
            last_attendance: user.attendance_summary?.last_attendance
          },
          rewards: {
            monthly: monthlyMilestones,
            lifetime: lifetimeMilestones
          },
          rewardStats: {
            totalClaims: milestoneAchievements.length,
            totalCoins: milestoneAchievements.reduce((sum, achievement) => {
              return sum + (achievement.milestone_id.reward_type === 'coin' ? achievement.milestone_id.reward_value : 0);
            }, 0),
            totalPermissions: milestoneAchievements.filter(achievement =>
              achievement.milestone_id.reward_type === 'permission'
            ).length,
            consecutiveClaims: 0, // Can be calculated if needed
            monthlyClaims: milestoneAchievements.filter(achievement =>
              achievement.month === currentMonth && achievement.year === currentYear
            ).length,
            lastClaimedAt: milestoneAchievements[0]?.claimed_at
          },
          currentMonth,
          currentYear
        }
      });

    } catch (error) {
      console.error('Error fetching milestone progress:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi lấy tiến độ milestone',
        error: error.message
      });
    }
  }
);

// User milestone claim endpoint (replaces legacy rewards system)
router.post('/milestones/:milestoneId/claim',
  authenticateToken,
  [
    param('milestoneId').isMongoId().withMessage('Milestone ID không hợp lệ')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { milestoneId } = req.params;

      // Import models
      const User = require('../models/user');
      const AttendanceMilestone = require('../models/attendanceReward'); // AttendanceMilestone model
      const UserAttendanceMilestone = require('../models/userAttendanceReward'); // UserAttendanceMilestone model
      const Transaction = require('../models/transaction'); // For transaction logging

      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Verify milestone exists and is active
      const milestone = await AttendanceMilestone.findById(milestoneId);
      if (!milestone || !milestone.is_active) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy milestone hoặc milestone không hoạt động'
        });
      }

      // Check if already claimed
      const existingClaim = await UserAttendanceMilestone.findOne({
        user_id: userId,
        milestone_id: milestoneId
      });

      if (existingClaim) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã nhận thưởng milestone này rồi'
        });
      }

      // Check if user meets the requirements
      const userAttendanceSummary = user.attendance_summary || {};
      let currentProgress = 0;

      if (milestone.type === 'monthly') {
        currentProgress = userAttendanceSummary.monthly_days || 0;
      } else if (milestone.type === 'lifetime') {
        currentProgress = userAttendanceSummary.total_days || 0;
      }

      if (currentProgress < milestone.required_days) {
        return res.status(400).json({
          success: false,
          message: `Bạn cần điểm danh ${milestone.required_days} ngày để nhận thưởng này. Hiện tại: ${currentProgress} ngày`
        });
      }

      // Get current date for monthly milestones
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // Create claim record
      // Get Vietnam timezone for claimed_at
      const { getVietnamNowForAPI } = require('../utils/timezone');

      const claimData = {
        user_id: userId,
        milestone_id: milestoneId,
        milestone_type: milestone.type,
        reward_type: milestone.reward_type,
        reward_value: milestone.reward_value,
        days_at_claim: userAttendanceSummary.total_days || 0,
        claimed_at: getVietnamNowForAPI(), // Use Vietnam timezone
        year: currentYear
      };

      // Add month for monthly milestones
      if (milestone.type === 'monthly') {
        claimData.month = currentMonth;
      }

      // Add permission_id if it's a permission reward
      if (milestone.reward_type === 'permission' && milestone.permission_id) {
        claimData.permission_id = milestone.permission_id;
      }

      const claimRecord = new UserAttendanceMilestone(claimData);
      await claimRecord.save();

      // Award the reward with proper transaction recording
      if (milestone.reward_type === 'coin' && milestone.reward_value > 0) {
        // Get user for transaction recording
        const userForUpdate = await User.findById(userId);
        if (!userForUpdate) {
          throw new Error('User not found during coin update');
        }

        // Prepare transaction metadata
        const description = `Phần thưởng milestone: ${milestone.title}`;
        const metadata = {
          milestone_claim_id: claimRecord._id,
          milestone_id: milestoneId,
          milestone_type: milestone.type,
          milestone_title: milestone.title,
          reward_type: milestone.reward_type,
          reward_value: milestone.reward_value,
          claimed_at: claimRecord.claimed_at, // This will be converted by toJSON
          required_days: milestone.required_days,
          user_progress_at_claim: currentProgress
        };

        // Add month and year for monthly milestones
        if (milestone.type === 'monthly') {
          metadata.month = currentMonth;
          metadata.year = currentYear;
        }

        // Add coins with transaction logging using the user method
        await userForUpdate.addCoins(milestone.reward_value, {
          description: description,
          metadata: metadata,
          type: 'reward', // Use 'reward' type for milestone rewards
          createTransaction: true
        });

        console.log(`[User] ✅ Added ${milestone.reward_value} coins with transaction record for milestone claim`);
      }

      // Handle permission rewards (if needed in the future)
      if (milestone.reward_type === 'permission' && milestone.permission_id) {
        // TODO: Implement permission reward logic if needed
        console.log(`[User] Permission reward not yet implemented for milestone ${milestoneId}`);
      }

      console.log(`[User] Claimed milestone: User ${userId}, Milestone ${milestoneId}, Reward: ${milestone.reward_value} ${milestone.reward_type}`);

      res.json({
        success: true,
        message: `Đã nhận thưởng milestone "${milestone.title}" thành công!`,
        data: {
          milestone_id: milestoneId,
          milestone_title: milestone.title,
          reward_type: milestone.reward_type,
          reward_value: milestone.reward_value,
          claimed_at: claimRecord.claimed_at
        }
      });

    } catch (error) {
      console.error('Error claiming milestone:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi nhận thưởng milestone',
        error: error.message
      });
    }
  }
);

module.exports = router;
