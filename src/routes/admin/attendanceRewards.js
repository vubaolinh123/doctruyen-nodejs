const express = require('express');
const router = express.Router();
const AttendanceMilestone = require('../../models/attendanceReward'); // Now AttendanceMilestone
const UserAttendanceMilestone = require('../../models/userAttendanceReward'); // Now UserAttendanceMilestone
const User = require('../../models/user');
const Attendance = require('../../models/attendance');
const PermissionTemplate = require('../../models/permissionTemplate');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * @route GET /api/admin/attendance/overview
 * @desc Lấy thống kê tổng quan điểm danh cho admin dashboard
 * @access Admin
 */
router.get('/overview',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // Get daily attendance trends for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyTrends = await Attendance.aggregate([
        {
          $match: {
            date: { $gte: thirtyDaysAgo },
            status: { $in: ['attended', 'purchased'] }
          }
        },
        {
          $group: {
            _id: {
              year: '$year',
              month: '$month',
              day: '$day'
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
      ]);

      // Get monthly completion rates
      const monthlyStats = await User.aggregate([
        {
          $match: {
            'attendance_summary.total_days': { $gt: 0 }
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            totalAttendanceDays: { $sum: '$attendance_summary.total_days' },
            averageMonthlyDays: { $avg: '$attendance_summary.monthly_days' },
            activeThisMonth: {
              $sum: {
                $cond: [
                  { $gt: ['$attendance_summary.monthly_days', 0] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      // Get milestone achievement stats
      const milestoneStats = await UserAttendanceMilestone.aggregate([
        {
          $group: {
            _id: '$milestone_type',
            totalAchievements: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user_id' }
          }
        },
        {
          $project: {
            _id: 1,
            totalAchievements: 1,
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        }
      ]);

      // Get user engagement metrics
      const engagementMetrics = await User.aggregate([
        {
          $match: {
            'attendance_summary.total_days': { $gt: 0 }
          }
        },
        {
          $bucket: {
            groupBy: '$attendance_summary.total_days',
            boundaries: [0, 7, 30, 90, 365, 1000],
            default: '1000+',
            output: {
              count: { $sum: 1 },
              avgMonthlyDays: { $avg: '$attendance_summary.monthly_days' }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          dailyTrends,
          monthlyStats: monthlyStats[0] || {
            totalUsers: 0,
            totalAttendanceDays: 0,
            averageMonthlyDays: 0,
            activeThisMonth: 0
          },
          milestoneStats,
          engagementMetrics,
          currentPeriod: {
            month: currentMonth,
            year: currentYear
          }
        }
      });
    } catch (error) {
      console.error('Error fetching attendance overview:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thống kê điểm danh',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/admin/attendance/users
 * @desc Lấy danh sách user với thông tin điểm danh cho admin
 * @access Admin
 */
router.get('/users',
  authenticateToken,
  requireAdmin,
  [
    query('search').optional().trim().isLength({ min: 1 }).withMessage('Search term không được rỗng'),
    query('attendance_min').optional().isInt({ min: 0 }).withMessage('Attendance min phải là số nguyên không âm'),
    query('attendance_max').optional().isInt({ min: 0 }).withMessage('Attendance max phải là số nguyên không âm'),
    query('active_only').optional().isBoolean().withMessage('Active only phải là boolean'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit phải từ 1-50')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        search,
        attendance_min,
        attendance_max,
        active_only,
        page = 1,
        limit = 10
      } = req.query;

      // Build query
      const query = {};

      // Search by username or email
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      // Filter by attendance range
      if (attendance_min !== undefined) {
        query['attendance_summary.total_days'] = { $gte: parseInt(attendance_min) };
      }
      if (attendance_max !== undefined) {
        query['attendance_summary.total_days'] = {
          ...query['attendance_summary.total_days'],
          $lte: parseInt(attendance_max)
        };
      }

      // Filter active users (those who attended this month)
      if (active_only === 'true') {
        query['attendance_summary.monthly_days'] = { $gt: 0 };
      }

      // Get total count
      const total = await User.countDocuments(query);

      // Get users with pagination
      const users = await User.find(query)
        .select('username email avatar attendance_summary created_at last_login')
        .sort({ 'attendance_summary.total_days': -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // Get milestone achievements for each user
      const usersWithMilestones = await Promise.all(users.map(async (user) => {
        const milestoneCount = await UserAttendanceMilestone.countDocuments({
          user_id: user._id
        });

        const latestMilestone = await UserAttendanceMilestone.findOne({
          user_id: user._id
        }).sort({ claimed_at: -1 }).populate('milestone_id', 'title type required_days');

        return {
          ...user,
          milestone_count: milestoneCount,
          latest_milestone: latestMilestone
        };
      }));

      res.json({
        success: true,
        data: {
          users: usersWithMilestones,
          pagination: {
            current: parseInt(page),
            total: Math.ceil(total / limit),
            count: users.length,
            totalRecords: total
          }
        }
      });
    } catch (error) {
      console.error('Error fetching users for attendance management:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách người dùng',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/admin/attendance/users/:userId
 * @desc Lấy thông tin chi tiết điểm danh của một user
 * @access Admin
 */
router.get('/users/:userId',
  authenticateToken,
  requireAdmin,
  [
    param('userId').isMongoId().withMessage('User ID không hợp lệ'),
    query('month').optional().isInt({ min: 0, max: 11 }).withMessage('Month phải từ 0-11'),
    query('year').optional().isInt({ min: 2020 }).withMessage('Year phải từ 2020 trở lên')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Ensure consistent month/year handling with user endpoint
      const currentDate = new Date();
      const defaultMonth = currentDate.getMonth();
      const defaultYear = currentDate.getFullYear();

      const month = req.query.month !== undefined ? parseInt(req.query.month) : defaultMonth;
      const year = req.query.year !== undefined ? parseInt(req.query.year) : defaultYear;

      // Get user info
      const user = await User.findById(userId)
        .select('username email avatar attendance_summary created_at last_login')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Get attendance records for specified month
      const attendanceRecords = await Attendance.find({
        user_id: userId,
        month: month,
        year: year
      }).sort({ day: 1 }).lean();

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
            achievement.month === month &&
            achievement.year === year))
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
          claimed: isAchieved, // Add claimed field for consistency with user API
          canClaim: currentProgress >= milestone.required_days && !isAchieved // Add canClaim field
        };
      });

      res.json({
        success: true,
        data: {
          user,
          attendance_records: attendanceRecords,
          milestone_achievements: milestoneAchievements,
          milestone_progress: milestoneProgress,
          period: {
            month: month,
            year: year
          }
        }
      });
    } catch (error) {
      console.error('Error fetching user attendance details:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin điểm danh người dùng',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/admin/attendance/users/:userId/toggle-today
 * @desc Toggle trạng thái điểm danh hôm nay của user
 * @access Admin
 */
router.post('/users/:userId/toggle-today',
  authenticateToken,
  requireAdmin,
  [
    param('userId').isMongoId().withMessage('User ID không hợp lệ')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const today = new Date();
      const day = today.getDate();
      const month = today.getMonth();
      const year = today.getFullYear();

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Check if attendance record exists for today
      const existingAttendance = await Attendance.findOne({
        user_id: userId,
        day,
        month,
        year
      });

      if (existingAttendance) {
        // Remove today's attendance
        await Attendance.deleteOne({ _id: existingAttendance._id });

        // Update user attendance summary
        await user.updateAttendanceSummary();

        res.json({
          success: true,
          message: 'Đã xóa điểm danh hôm nay',
          data: { action: 'removed', date: today }
        });
      } else {
        // Add today's attendance
        await Attendance.create({
          user_id: userId,
          date: today,
          status: 'attended',
          reward: 10,
          day,
          month,
          year,
          notes: 'Điểm danh được thêm bởi admin',
          attendance_time: new Date()
        });

        // Update user attendance summary
        await user.updateAttendanceSummary();

        res.json({
          success: true,
          message: 'Đã thêm điểm danh hôm nay',
          data: { action: 'added', date: today }
        });
      }
    } catch (error) {
      console.error('Error toggling user attendance:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi thay đổi trạng thái điểm danh',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/admin/attendance/users/:userId/mark-day
 * @desc Đánh dấu một ngày cụ thể là đã điểm danh
 * @access Admin
 */
router.post('/users/:userId/mark-day',
  authenticateToken,
  requireAdmin,
  [
    param('userId').isMongoId().withMessage('User ID không hợp lệ'),
    body('date').isISO8601().withMessage('Date phải là định dạng ISO8601'),
    body('action').isIn(['add', 'remove']).withMessage('Action phải là add hoặc remove')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { date, action } = req.body;

      const targetDate = new Date(date);
      const day = targetDate.getDate();
      const month = targetDate.getMonth();
      const year = targetDate.getFullYear();

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Check if date is not in the future
      if (targetDate > new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Không thể đánh dấu ngày trong tương lai'
        });
      }

      const existingAttendance = await Attendance.findOne({
        user_id: userId,
        day,
        month,
        year
      });

      if (action === 'add') {
        if (existingAttendance) {
          return res.status(400).json({
            success: false,
            message: 'Ngày này đã được điểm danh'
          });
        }

        await Attendance.create({
          user_id: userId,
          date: targetDate,
          status: 'attended',
          reward: 10,
          day,
          month,
          year,
          notes: 'Điểm danh được thêm bởi admin',
          attendance_time: new Date()
        });

        var message = 'Đã thêm điểm danh cho ngày ' + targetDate.toLocaleDateString('vi-VN');
      } else {
        if (!existingAttendance) {
          return res.status(400).json({
            success: false,
            message: 'Ngày này chưa được điểm danh'
          });
        }

        await Attendance.deleteOne({ _id: existingAttendance._id });
        var message = 'Đã xóa điểm danh cho ngày ' + targetDate.toLocaleDateString('vi-VN');
      }

      // Update user attendance summary
      await user.updateAttendanceSummary();

      res.json({
        success: true,
        message,
        data: { action, date: targetDate }
      });
    } catch (error) {
      console.error('Error marking attendance day:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi đánh dấu điểm danh',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/admin/attendance/milestones
 * @desc Lấy danh sách mốc điểm danh (milestone-based system)
 * @access Admin
 */
router.get('/milestones',
  authenticateToken,
  requireAdmin,
  [
    query('type').optional().isIn(['monthly', 'lifetime']).withMessage('Type phải là monthly hoặc lifetime'),
    query('is_active').optional().isBoolean().withMessage('is_active phải là boolean'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit phải từ 1-100')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { type, is_active, page = 1, limit = 20 } = req.query;

      // Build query
      const query = {};
      if (type) query.type = type;
      if (is_active !== undefined) query.is_active = is_active === 'true';

      // Get total count
      const total = await AttendanceMilestone.countDocuments(query);

      // Get milestones with pagination
      const milestones = await AttendanceMilestone.find(query)
        .populate('permission_id', 'name description')
        .sort({ type: 1, required_days: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // Get achievement statistics for each milestone
      const milestonesWithStats = await Promise.all(milestones.map(async (milestone) => {
        const achievementCount = await UserAttendanceMilestone.countDocuments({
          milestone_id: milestone._id
        });

        return {
          ...milestone,
          achievement_count: achievementCount
        };
      }));

      res.json({
        success: true,
        data: {
          milestones: milestonesWithStats,
          pagination: {
            current: parseInt(page),
            total: Math.ceil(total / limit),
            count: milestones.length,
            totalRecords: total
          }
        }
      });
    } catch (error) {
      console.error('Error fetching attendance milestones:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách mốc điểm danh',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/admin/attendance/milestones/:id
 * @desc Lấy chi tiết mốc điểm danh
 * @access Admin
 */
router.get('/milestones/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isMongoId().withMessage('ID không hợp lệ')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const milestone = await AttendanceMilestone.findById(req.params.id)
        .populate('permission_id', 'name description')
        .lean();

      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy mốc điểm danh'
        });
      }

      // Get achievement statistics
      const achievementCount = await UserAttendanceMilestone.countDocuments({
        milestone_id: milestone._id
      });

      res.json({
        success: true,
        data: {
          ...milestone,
          achievement_count: achievementCount
        }
      });
    } catch (error) {
      console.error('Error fetching attendance milestone:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin mốc điểm danh',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/admin/attendance/milestones
 * @desc Tạo mốc điểm danh mới
 * @access Admin
 */
router.post('/milestones',
  authenticateToken,
  requireAdmin,
  [
    body('type').isIn(['monthly', 'lifetime']).withMessage('Type phải là monthly hoặc lifetime'),
    body('required_days').isInt({ min: 1 }).withMessage('Số ngày yêu cầu phải là số nguyên dương'),
    body('reward_type').isIn(['coin', 'permission']).withMessage('Reward type phải là coin hoặc permission'),
    body('reward_value').optional().isInt({ min: 0 }).withMessage('Reward value phải là số nguyên không âm'),
    body('permission_id').optional({ values: 'falsy' }).isMongoId().withMessage('Permission ID không hợp lệ'),
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title phải từ 1-200 ký tự'),
    body('description').trim().isLength({ min: 1, max: 500 }).withMessage('Description phải từ 1-500 ký tự'),
    body('is_active').optional().isBoolean().withMessage('is_active phải là boolean')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const milestoneData = req.body;

      // Validate business logic
      if (milestoneData.reward_type === 'coin' && (!milestoneData.reward_value || milestoneData.reward_value <= 0)) {
        return res.status(400).json({
          success: false,
          message: 'Giá trị xu phải lớn hơn 0 khi loại phần thưởng là coin'
        });
      }

      if (milestoneData.reward_type === 'permission' && !milestoneData.permission_id) {
        return res.status(400).json({
          success: false,
          message: 'Permission ID là bắt buộc khi loại phần thưởng là permission'
        });
      }

      // Kiểm tra permission tồn tại nếu là permission reward
      if (milestoneData.reward_type === 'permission') {
        const permission = await PermissionTemplate.findById(milestoneData.permission_id);
        if (!permission) {
          return res.status(400).json({
            success: false,
            message: 'Permission không tồn tại'
          });
        }
      }

      // Check for duplicate milestone
      const existingMilestone = await AttendanceMilestone.findOne({
        type: milestoneData.type,
        required_days: milestoneData.required_days
      });

      if (existingMilestone) {
        return res.status(400).json({
          success: false,
          message: `Mốc ${milestoneData.type} ${milestoneData.required_days} ngày đã tồn tại`
        });
      }

      const milestone = await AttendanceMilestone.create(milestoneData);

      res.status(201).json({
        success: true,
        message: 'Tạo mốc điểm danh thành công',
        data: milestone
      });
    } catch (error) {
      console.error('Error creating attendance milestone:', error);

      if (error.message.includes('đã tồn tại')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo mốc điểm danh',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/admin/attendance/milestones/:id
 * @desc Cập nhật mốc điểm danh
 * @access Admin
 */
router.put('/milestones/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isMongoId().withMessage('ID không hợp lệ'),
    body('type').optional().isIn(['monthly', 'lifetime']).withMessage('Type phải là monthly hoặc lifetime'),
    body('required_days').optional().isInt({ min: 1 }).withMessage('Số ngày yêu cầu phải là số nguyên dương'),
    body('reward_type').optional().isIn(['coin', 'permission']).withMessage('Reward type phải là coin hoặc permission'),
    body('reward_value').optional().isInt({ min: 0 }).withMessage('Reward value phải là số nguyên không âm'),
    body('permission_id').optional({ values: 'falsy' }).isMongoId().withMessage('Permission ID không hợp lệ'),
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title phải từ 1-200 ký tự'),
    body('description').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Description phải từ 1-500 ký tự'),
    body('is_active').optional().isBoolean().withMessage('is_active phải là boolean')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const updateData = req.body;

      // Validate business logic
      if (updateData.reward_type === 'coin' && updateData.reward_value !== undefined && updateData.reward_value <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Giá trị xu phải lớn hơn 0 khi loại phần thưởng là coin'
        });
      }

      if (updateData.reward_type === 'permission' && !updateData.permission_id) {
        return res.status(400).json({
          success: false,
          message: 'Permission ID là bắt buộc khi loại phần thưởng là permission'
        });
      }

      // Kiểm tra permission tồn tại nếu update permission_id
      if (updateData.permission_id) {
        const permission = await PermissionTemplate.findById(updateData.permission_id);
        if (!permission) {
          return res.status(400).json({
            success: false,
            message: 'Permission không tồn tại'
          });
        }
      }

      // Check for duplicate if updating type or required_days
      if (updateData.type || updateData.required_days) {
        const existingMilestone = await AttendanceMilestone.findOne({
          _id: { $ne: req.params.id },
          type: updateData.type,
          required_days: updateData.required_days
        });

        if (existingMilestone) {
          return res.status(400).json({
            success: false,
            message: `Mốc ${updateData.type} ${updateData.required_days} ngày đã tồn tại`
          });
        }
      }

      const milestone = await AttendanceMilestone.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate('permission_id', 'name description');

      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy mốc điểm danh'
        });
      }

      res.json({
        success: true,
        message: 'Cập nhật mốc điểm danh thành công',
        data: milestone
      });
    } catch (error) {
      console.error('Error updating attendance milestone:', error);

      if (error.message.includes('đã tồn tại') || error.message.includes('Không tìm thấy')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật mốc điểm danh',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/admin/attendance/milestones/:id
 * @desc Xóa mốc điểm danh
 * @access Admin
 */
router.delete('/milestones/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isMongoId().withMessage('ID không hợp lệ')
  ],
  validateRequest,
  async (req, res) => {
    try {
      // Check if milestone has any achievements
      const achievementCount = await UserAttendanceMilestone.countDocuments({
        milestone_id: req.params.id
      });

      if (achievementCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Không thể xóa mốc này vì đã có ${achievementCount} người dùng đạt được. Hãy vô hiệu hóa thay vì xóa.`
        });
      }

      const milestone = await AttendanceMilestone.findByIdAndDelete(req.params.id);

      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy mốc điểm danh'
        });
      }

      res.json({
        success: true,
        message: 'Xóa mốc điểm danh thành công',
        data: milestone
      });
    } catch (error) {
      console.error('Error deleting attendance milestone:', error);

      if (error.message.includes('Không tìm thấy')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa mốc điểm danh',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/admin/attendance/users/:userId/milestones/:milestoneId/reset
 * @desc Reset milestone claim status for a specific user
 * @access Admin
 */
router.post('/users/:userId/milestones/:milestoneId/reset',
  authenticateToken,
  requireAdmin,
  [
    param('userId').isMongoId().withMessage('User ID không hợp lệ'),
    param('milestoneId').isMongoId().withMessage('Milestone ID không hợp lệ')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId, milestoneId } = req.params;

      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Verify milestone exists
      const milestone = await AttendanceMilestone.findById(milestoneId);
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy milestone'
        });
      }

      // Find and remove the claim record (consider month/year for monthly milestones)
      let claimQuery = {
        user_id: userId,
        milestone_id: milestoneId
      };

      // For monthly milestones, we need to specify which month/year to reset
      // Default to current month/year if not specified
      if (milestone.type === 'monthly') {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // You could extend this to accept month/year parameters if needed
        claimQuery.month = currentMonth;
        claimQuery.year = currentYear;
      }

      const claimRecord = await UserAttendanceMilestone.findOneAndDelete(claimQuery);

      if (!claimRecord) {
        return res.status(404).json({
          success: false,
          message: `Người dùng chưa claim milestone này${milestone.type === 'monthly' ? ' trong tháng hiện tại' : ''}`
        });
      }

      console.log(`[Admin] Reset milestone claim: User ${userId}, Milestone ${milestoneId}`);

      res.json({
        success: true,
        message: `Đã reset milestone "${milestone.title}" cho người dùng ${user.username}`,
        data: {
          user_id: userId,
          milestone_id: milestoneId,
          milestone_title: milestone.title,
          reset_at: new Date()
        }
      });
    } catch (error) {
      console.error('Error resetting milestone claim:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi reset milestone claim',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/admin/attendance/users/:userId/milestones/:milestoneId/force-claim
 * @desc Force claim a milestone for a specific user
 * @access Admin
 */
router.post('/users/:userId/milestones/:milestoneId/force-claim',
  authenticateToken,
  requireAdmin,
  [
    param('userId').isMongoId().withMessage('User ID không hợp lệ'),
    param('milestoneId').isMongoId().withMessage('Milestone ID không hợp lệ')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId, milestoneId } = req.params;

      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Verify milestone exists
      const milestone = await AttendanceMilestone.findById(milestoneId);
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy milestone'
        });
      }

      // Get current date for monthly milestones (declare early to avoid initialization errors)
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // Check if already claimed (consider month/year for monthly milestones)
      let existingClaimQuery = {
        user_id: userId,
        milestone_id: milestoneId
      };

      // For monthly milestones, check for current month/year
      if (milestone.type === 'monthly') {
        existingClaimQuery.month = currentMonth;
        existingClaimQuery.year = currentYear;
      }

      const existingClaim = await UserAttendanceMilestone.findOne(existingClaimQuery);

      if (existingClaim) {
        return res.status(400).json({
          success: false,
          message: `Người dùng đã claim milestone này rồi${milestone.type === 'monthly' ? ` trong tháng ${currentMonth + 1}/${currentYear}` : ''}`
        });
      }

      // Create claim record
      const claimData = {
        user_id: userId,
        milestone_id: milestoneId,
        milestone_type: milestone.type,
        reward_type: milestone.reward_type,
        reward_value: milestone.reward_value,
        days_at_claim: user.attendance_summary?.total_days || 0,
        claimed_at: new Date(),
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

      // Award the reward using User.addCoins to create transaction record
      if (milestone.reward_type === 'coin' && milestone.reward_value > 0) {
        // Get the user document to use addCoins method
        const userForUpdate = await User.findById(userId);
        if (!userForUpdate) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy người dùng để cập nhật'
          });
        }

        // Prepare transaction metadata for admin force-claim
        const description = `Admin cộng xu điểm danh: ${milestone.title}`;
        const metadata = {
          admin_action: 'force_claim_milestone',
          admin_user_id: req.user.id, // Admin who performed the action
          milestone_claim_id: claimRecord._id,
          milestone_id: milestoneId,
          milestone_type: milestone.type,
          milestone_title: milestone.title,
          reward_type: milestone.reward_type,
          reward_value: milestone.reward_value,
          claimed_at: claimRecord.claimed_at,
          required_days: milestone.required_days,
          user_progress_at_claim: user.attendance_summary?.total_days || 0,
          force_claim_reason: 'admin_manual_award'
        };

        // Add month/year for monthly milestones
        if (milestone.type === 'monthly') {
          metadata.month = currentMonth;
          metadata.year = currentYear;
        }

        // Use addCoins method to create both coin update and transaction record
        await userForUpdate.addCoins(milestone.reward_value, {
          description: description,
          metadata: metadata,
          type: 'admin', // Mark as admin-initiated transaction
          createTransaction: true
        });

        console.log(`[Admin] Force claimed milestone with transaction: User ${userId}, Milestone ${milestoneId}, Reward: ${milestone.reward_value} ${milestone.reward_type}`);
      }

      // TODO: Handle permission rewards if needed
      // if (milestone.reward_type === 'permission' && milestone.permission_id) {
      //   // Add permission logic here
      // }

      console.log(`[Admin] Force claimed milestone: User ${userId}, Milestone ${milestoneId}, Reward: ${milestone.reward_value} ${milestone.reward_type}`);

      res.json({
        success: true,
        message: `Đã force claim milestone "${milestone.title}" cho người dùng ${user.username}`,
        data: {
          user_id: userId,
          milestone_id: milestoneId,
          milestone_title: milestone.title,
          reward_type: milestone.reward_type,
          reward_value: milestone.reward_value,
          claimed_at: claimRecord.claimed_at
        }
      });
    } catch (error) {
      console.error('Error force claiming milestone:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi force claim milestone',
        error: error.message
      });
    }
  }
);

module.exports = router;
