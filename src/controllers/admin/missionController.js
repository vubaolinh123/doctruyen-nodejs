/**
 * Admin Mission Management Controller
 * Handles admin operations for mission management
 */

const User = require('../../models/user');
const Mission = require('../../models/mission');
const MissionProgress = require('../../models/missionProgress');

/**
 * Get paginated list of users with mission statistics
 * GET /api/admin/missions/users
 */
const getUsersWithMissionStats = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Get users with basic info
    const users = await User.find(searchQuery)
      .select('name email avatar level role createdAt lastActiveAt')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count
    const totalUsers = await User.countDocuments(searchQuery);

    // Get mission statistics for each user
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Calculate current week
    const firstDayOfYear = new Date(currentYear, 0, 1);
    const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
    const currentWeek = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    const usersWithStats = await Promise.all(users.map(async (user) => {
      // Get daily mission progress
      const dailyProgress = await MissionProgress.find({
        user_id: user._id,
        day: currentDay,
        month: currentMonth,
        year: currentYear
      }).populate('mission_id', 'type title');

      // Get weekly mission progress
      const weeklyProgress = await MissionProgress.find({
        user_id: user._id,
        week: currentWeek,
        year: currentYear
      }).populate('mission_id', 'type title');

      // Calculate statistics
      const dailyMissions = dailyProgress.filter(p => p.mission_id?.type === 'daily');
      const weeklyMissions = weeklyProgress.filter(p => p.mission_id?.type === 'weekly');

      const dailyCompleted = dailyMissions.filter(p => p.completed).length;
      const weeklyCompleted = weeklyMissions.filter(p => p.completed).length;
      const dailyTotal = dailyMissions.length;
      const weeklyTotal = weeklyMissions.length;

      // Get total missions completed all time
      const totalCompleted = await MissionProgress.countDocuments({
        user_id: user._id,
        completed: true
      });

      return {
        ...user,
        missionStats: {
          daily: {
            completed: dailyCompleted,
            total: dailyTotal,
            completionRate: dailyTotal > 0 ? Math.round((dailyCompleted / dailyTotal) * 100) : 0
          },
          weekly: {
            completed: weeklyCompleted,
            total: weeklyTotal,
            completionRate: weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0
          },
          totalCompleted,
          lastActivity: user.lastActiveAt || user.createdAt
        }
      };
    }));

    // Get global statistics
    const totalActiveUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const activeMissions = await Mission.countDocuments({ status: true });

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalUsers / limitNum),
          totalUsers,
          limit: limitNum
        },
        globalStats: {
          totalActiveUsers,
          activeMissions,
          currentPeriod: {
            day: currentDay,
            month: currentMonth + 1,
            year: currentYear,
            week: currentWeek
          }
        }
      }
    });

  } catch (error) {
    console.error('[Admin Mission Controller] Error getting users with mission stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Search users for mission management
 * GET /api/admin/missions/users/search
 */
const searchUsers = async (req, res) => {
  try {
    const { query = '', limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      role: { $ne: 'admin' }
    })
    .select('name email avatar level')
    .limit(parseInt(limit))
    .lean();

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('[Admin Mission Controller] Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Get detailed mission data for specific user
 * GET /api/admin/missions/user/:userId
 */
const getUserMissionDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user exists
    const user = await User.findById(userId)
      .select('name email avatar level role createdAt lastActiveAt')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    // Get current time info
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const firstDayOfYear = new Date(currentYear, 0, 1);
    const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
    const currentWeek = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    // Get all active missions
    const activeMissions = await Mission.find({ status: true })
      .sort({ type: 1, order: 1 })
      .lean();

    // Get current mission progress
    const currentProgress = await MissionProgress.find({
      user_id: userId,
      $or: [
        { day: currentDay, month: currentMonth, year: currentYear },
        { week: currentWeek, year: currentYear }
      ]
    }).lean();

    // Combine missions with progress
    const missionsWithProgress = activeMissions.map(mission => {
      const progress = currentProgress.find(p => 
        p.mission_id.toString() === mission._id.toString()
      );

      return {
        ...mission,
        progress: progress || {
          current_progress: 0,
          completed: false,
          rewarded: false,
          sub_progress: []
        }
      };
    });

    // Get historical statistics
    const totalCompleted = await MissionProgress.countDocuments({
      user_id: userId,
      completed: true
    });

    const totalRewarded = await MissionProgress.countDocuments({
      user_id: userId,
      rewarded: true
    });

    // Get recent mission activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await MissionProgress.find({
      user_id: userId,
      createdAt: { $gte: sevenDaysAgo }
    })
    .populate('mission_id', 'title type')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    // Filter out activities with null mission_id (deleted missions)
    const validRecentActivity = recentActivity.filter(activity => activity.mission_id);

    // Log warning if there are activities with null mission_id
    const nullMissionCount = recentActivity.length - validRecentActivity.length;
    if (nullMissionCount > 0) {
      console.warn(`[Admin Mission Controller] Found ${nullMissionCount} activities with null mission_id for user ${userId}`);
    }

    res.json({
      success: true,
      data: {
        user,
        missions: {
          daily: missionsWithProgress.filter(m => m.type === 'daily'),
          weekly: missionsWithProgress.filter(m => m.type === 'weekly')
        },
        statistics: {
          totalCompleted,
          totalRewarded,
          currentPeriod: {
            day: currentDay,
            month: currentMonth + 1,
            year: currentYear,
            week: currentWeek
          }
        },
        recentActivity: validRecentActivity
      }
    });

  } catch (error) {
    console.error('[Admin Mission Controller] Error getting user mission details:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Force complete specific mission for user
 * POST /api/admin/missions/user/:userId/complete
 */
const forceCompleteMission = async (req, res) => {
  try {
    const { userId } = req.params;
    const { missionId } = req.body;

    // Validate user and mission exist
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    const mission = await Mission.findById(missionId);
    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Nhiệm vụ không tồn tại'
      });
    }

    // Get current time info
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const firstDayOfYear = new Date(currentYear, 0, 1);
    const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
    const currentWeek = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    // Find or create mission progress
    let missionProgress = await MissionProgress.findOne({
      user_id: userId,
      mission_id: missionId,
      year: currentYear,
      month: currentMonth,
      day: currentDay
    });

    if (!missionProgress) {
      missionProgress = new MissionProgress({
        user_id: userId,
        mission_id: missionId,
        current_progress: 0,
        completed: false,
        rewarded: false,
        day: currentDay,
        month: currentMonth,
        year: currentYear,
        week: mission.type === 'weekly' ? currentWeek : 0,
        sub_progress: []
      });
    }

    // Force complete the mission
    missionProgress.current_progress = mission.requirement.count;
    missionProgress.completed = true;
    missionProgress.completed_at = new Date();

    // Complete all sub-missions if any
    if (mission.subMissions && mission.subMissions.length > 0) {
      missionProgress.sub_progress = mission.subMissions.map((subMission, index) => ({
        sub_mission_index: index,
        current_progress: subMission.requirement.count,
        completed: true
      }));
    }

    await missionProgress.save();

    res.json({
      success: true,
      message: 'Nhiệm vụ đã được hoàn thành thành công',
      data: missionProgress
    });

  } catch (error) {
    console.error('[Admin Mission Controller] Error force completing mission:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Reset specific mission or all missions by type for user
 * POST /api/admin/missions/user/:userId/reset
 */
const resetUserMissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { missionId, type } = req.body; // missionId for specific, type for bulk (daily/weekly)

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    let deleteQuery = { user_id: userId };
    let message = '';

    if (missionId) {
      // Reset specific mission
      const mission = await Mission.findById(missionId);
      if (!mission) {
        return res.status(404).json({
          success: false,
          message: 'Nhiệm vụ không tồn tại'
        });
      }

      deleteQuery.mission_id = missionId;
      message = `Nhiệm vụ "${mission.title}" đã được reset thành công`;
    } else if (type) {
      // Reset all missions by type
      if (!['daily', 'weekly'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Loại nhiệm vụ không hợp lệ'
        });
      }

      // Get missions of specified type
      const missions = await Mission.find({ type, status: true });
      const missionIds = missions.map(m => m._id);

      deleteQuery.mission_id = { $in: missionIds };
      message = `Tất cả nhiệm vụ ${type === 'daily' ? 'hàng ngày' : 'hàng tuần'} đã được reset thành công`;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Cần cung cấp missionId hoặc type'
      });
    }

    // Delete mission progress records
    const deleteResult = await MissionProgress.deleteMany(deleteQuery);

    res.json({
      success: true,
      message,
      data: {
        deletedCount: deleteResult.deletedCount
      }
    });

  } catch (error) {
    console.error('[Admin Mission Controller] Error resetting user missions:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Bulk reset missions for all users
 * POST /api/admin/missions/bulk/reset
 */
const bulkResetMissions = async (req, res) => {
  try {
    const { type } = req.body; // daily or weekly

    if (!['daily', 'weekly'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Loại nhiệm vụ không hợp lệ'
      });
    }

    // Get missions of specified type
    const missions = await Mission.find({ type, status: true });
    const missionIds = missions.map(m => m._id);

    if (missionIds.length === 0) {
      return res.json({
        success: true,
        message: `Không có nhiệm vụ ${type === 'daily' ? 'hàng ngày' : 'hàng tuần'} nào để reset`,
        data: { deletedCount: 0 }
      });
    }

    // Delete all progress for these missions
    const deleteResult = await MissionProgress.deleteMany({
      mission_id: { $in: missionIds }
    });

    res.json({
      success: true,
      message: `Đã reset tất cả nhiệm vụ ${type === 'daily' ? 'hàng ngày' : 'hàng tuần'} cho tất cả người dùng`,
      data: {
        deletedCount: deleteResult.deletedCount,
        affectedMissions: missionIds.length
      }
    });

  } catch (error) {
    console.error('[Admin Mission Controller] Error bulk resetting missions:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

module.exports = {
  getUsersWithMissionStats,
  searchUsers,
  getUserMissionDetails,
  forceCompleteMission,
  resetUserMissions,
  bulkResetMissions
};
