/**
 * Attendance Service
 * Contains business logic for attendance operations
 * Refactored from existing routes to follow MVC pattern
 */

const User = require('../models/user');
const Attendance = require('../models/attendance');
const SystemSettings = require('../models/systemSettings');
const Mission = require('../models/mission');
const MissionProgress = require('../models/missionProgress');
const { ApiError } = require('../utils/errorHandler');

/**
 * Check in attendance for current day
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Check-in result
 */
const checkIn = async (userId) => {
  console.log(`[AttendanceService] Processing check-in for user: ${userId}`);

  // Get user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  // Check if already checked in today
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const existingAttendance = await Attendance.findOne({
    user_id: userId,
    date: {
      $gte: startOfDay,
      $lt: endOfDay
    }
  });

  if (existingAttendance) {
    throw new ApiError(400, 'Bạn đã điểm danh hôm nay rồi');
  }

  // Get daily coin reward from settings
  const dailyCoins = await SystemSettings.getSetting('daily_attendance_coins', 10);

  // Create attendance record
  const attendance = await Attendance.create({
    user_id: userId,
    date: today,
    coins_earned: dailyCoins,
    is_purchased: false
  });

  // Add coins to user
  await user.addCoins(dailyCoins, {
    description: 'Điểm danh hàng ngày',
    metadata: {
      attendance_id: attendance._id,
      date: today.toISOString().split('T')[0]
    }
  });

  // Update user attendance summary
  await user.updateAttendanceSummary();

  // Get updated user stats
  const updatedUser = await User.findById(userId).populate('attendance_summary');
  const stats = updatedUser.attendance_summary || {
    total_days: 0,
    current_streak: 0,
    longest_streak: 0
  };

  console.log(`[AttendanceService] Check-in successful. New stats: streak=${stats.current_streak}, total=${stats.total_days}`);

  // Track attendance missions (don't let mission tracking errors fail attendance)
  let missionResults = null;
  try {
    missionResults = await trackAttendanceMissions(userId);
    console.log('[AttendanceService] Mission tracking completed:', {
      userId,
      trackedMissions: missionResults.tracked,
      hasError: !!missionResults.error
    });
  } catch (missionError) {
    // Log mission tracking errors but don't fail the attendance process
    console.error('[AttendanceService] Error tracking attendance missions:', {
      userId,
      error: missionError.message
    });
  }

  return {
    attendance,
    coinsEarned: dailyCoins,
    userStats: {
      totalDays: stats.total_days,
      currentStreak: stats.current_streak,
      longestStreak: stats.longest_streak
    },
    userCoin: updatedUser.coin,
    missions: missionResults // Include mission tracking results
  };
};

/**
 * Get attendance status for current day
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Attendance status
 */
const getAttendanceStatus = async (userId) => {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const todayAttendance = await Attendance.findOne({
    user_id: userId,
    date: {
      $gte: startOfDay,
      $lt: endOfDay
    }
  });

  const user = await User.findById(userId).populate('attendance_summary');
  const stats = user.attendance_summary || {
    total_days: 0,
    current_streak: 0,
    longest_streak: 0
  };

  return {
    hasCheckedInToday: !!todayAttendance,
    todayAttendance: todayAttendance || null,
    userStats: {
      totalDays: stats.total_days,
      currentStreak: stats.current_streak,
      longestStreak: stats.longest_streak
    },
    userCoin: user.coin
  };
};

/**
 * Get attendance history for user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Attendance history
 */
const getAttendanceHistory = async (userId, options = {}) => {
  const { month, year, limit = 31, page = 1 } = options;

  const query = { user_id: userId };

  // Add date filters if provided
  if (month !== undefined && year !== undefined) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1);
    query.date = {
      $gte: startDate,
      $lt: endDate
    };
  } else if (year !== undefined) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    query.date = {
      $gte: startDate,
      $lt: endDate
    };
  }

  const skip = (page - 1) * limit;

  const [attendances, total] = await Promise.all([
    Attendance.find(query)
      .sort({ date: -1 })
      .limit(limit)
      .skip(skip)
      .lean(),
    Attendance.countDocuments(query)
  ]);

  return {
    attendances,
    pagination: {
      current: page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get attendance statistics for user
 * @param {string} userId - User ID
 * @param {number} year - Optional year filter
 * @returns {Promise<Object>} Attendance statistics
 */
const getAttendanceStats = async (userId, year) => {
  const user = await User.findById(userId).populate('attendance_summary');
  const stats = user.attendance_summary || {
    total_days: 0,
    current_streak: 0,
    longest_streak: 0
  };

  // Get year-specific stats if requested
  let yearStats = null;
  if (year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const yearAttendances = await Attendance.find({
      user_id: userId,
      date: {
        $gte: startDate,
        $lt: endDate
      }
    }).sort({ date: 1 });

    yearStats = {
      year,
      totalDays: yearAttendances.length,
      totalCoinsEarned: yearAttendances.reduce((sum, att) => sum + (att.coins_earned || 0), 0),
      purchasedDays: yearAttendances.filter(att => att.is_purchased).length,
      monthlyBreakdown: {}
    };

    // Calculate monthly breakdown
    for (let month = 0; month < 12; month++) {
      const monthAttendances = yearAttendances.filter(att => att.date.getMonth() === month);
      yearStats.monthlyBreakdown[month] = {
        totalDays: monthAttendances.length,
        coinsEarned: monthAttendances.reduce((sum, att) => sum + (att.coins_earned || 0), 0)
      };
    }
  }

  return {
    overallStats: {
      totalDays: stats.total_days,
      currentStreak: stats.current_streak,
      longestStreak: stats.longest_streak
    },
    yearStats
  };
};

/**
 * Get attendance calendar for specific month
 * @param {string} userId - User ID
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @returns {Promise<Object>} Calendar data
 */
const getAttendanceCalendar = async (userId, month, year) => {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 1);

  const attendances = await Attendance.find({
    user_id: userId,
    date: {
      $gte: startDate,
      $lt: endDate
    }
  }).lean();

  // Create calendar grid
  const calendar = {};
  attendances.forEach(att => {
    const day = att.date.getDate();
    calendar[day] = {
      attended: true,
      coinsEarned: att.coins_earned || 0,
      isPurchased: att.is_purchased || false,
      date: att.date
    };
  });

  // Fill in missing days
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    if (!calendar[day]) {
      calendar[day] = {
        attended: false,
        coinsEarned: 0,
        isPurchased: false,
        date: new Date(year, month, day)
      };
    }
  }

  return {
    month,
    year,
    calendar,
    summary: {
      totalDays: attendances.length,
      totalCoins: attendances.reduce((sum, att) => sum + (att.coins_earned || 0), 0),
      purchasedDays: attendances.filter(att => att.is_purchased).length
    }
  };
};

/**
 * Get user's attendance summary
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Attendance summary
 */
const getAttendanceSummary = async (userId) => {
  const user = await User.findById(userId).populate('attendance_summary');
  const stats = user.attendance_summary || {
    total_days: 0,
    current_streak: 0,
    longest_streak: 0
  };

  // Get today's attendance status
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const todayAttendance = await Attendance.findOne({
    user_id: userId,
    date: {
      $gte: startOfDay,
      $lt: endOfDay
    }
  });

  return {
    userStats: {
      totalDays: stats.total_days,
      currentStreak: stats.current_streak,
      longestStreak: stats.longest_streak
    },
    todayStatus: {
      hasCheckedIn: !!todayAttendance,
      attendance: todayAttendance
    },
    userCoin: user.coin
  };
};

/**
 * Get available missed days for purchase
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Available missed days
 */
const getAvailableMissedDays = async (userId) => {
  const maxBuybackDays = await SystemSettings.getSetting('max_buyback_days', 30);
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - maxBuybackDays);

  // Get user's attendance records
  const attendanceRecords = await Attendance.find({
    user_id: userId,
    date: { $gte: startDate, $lt: now }
  }).select('date is_purchased');

  // Create map of attended/purchased dates
  const attendedDates = new Set();
  attendanceRecords.forEach(record => {
    const dateStr = record.date.toISOString().split('T')[0];
    attendedDates.add(dateStr);
  });

  // Generate list of missed days
  const missedDays = [];
  const currentDate = new Date(startDate);

  while (currentDate < now) {
    const dateStr = currentDate.toISOString().split('T')[0];

    if (!attendedDates.has(dateStr)) {
      missedDays.push({
        date: dateStr,
        dayOfWeek: currentDate.toLocaleDateString('vi-VN', { weekday: 'long' }),
        canPurchase: true
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    missedDays: missedDays.reverse(), // Most recent first
    totalMissed: missedDays.length,
    maxBuybackDays
  };
};

/**
 * Buy missed attendance days
 * @param {string} userId - User ID
 * @param {Array<string>} dates - Array of date strings to purchase
 * @returns {Promise<Object>} Purchase result
 */
const buyMissedDays = async (userId, dates) => {
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new ApiError(400, 'Danh sách ngày không hợp lệ');
  }

  const costPerDay = await SystemSettings.getSetting('missed_day_cost', 50);
  const totalCost = dates.length * costPerDay;

  // Check user balance
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  if (user.coin < totalCost) {
    throw new ApiError(400, `Không đủ xu. Cần ${totalCost} xu, bạn có ${user.coin} xu`);
  }

  // Process purchase
  const purchasedDates = [];
  const errors = [];

  for (const dateStr of dates) {
    try {
      const date = new Date(dateStr);

      // Check if already attended
      const existingAttendance = await Attendance.findOne({
        user_id: userId,
        date: {
          $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
        }
      });

      if (existingAttendance) {
        errors.push(`Ngày ${dateStr} đã có điểm danh`);
        continue;
      }

      // Create purchased attendance
      await Attendance.create({
        user_id: userId,
        date: date,
        is_purchased: true,
        coins_earned: 0 // No coins for purchased days
      });

      purchasedDates.push(dateStr);
    } catch (error) {
      errors.push(`Lỗi khi mua ngày ${dateStr}: ${error.message}`);
    }
  }

  // Deduct coins and create transaction
  if (purchasedDates.length > 0) {
    const actualCost = purchasedDates.length * costPerDay;

    await user.addCoins(-actualCost, {
      description: `Mua điểm danh bù cho ${purchasedDates.length} ngày`,
      metadata: {
        purchased_dates: purchasedDates,
        cost_per_day: costPerDay,
        total_cost: actualCost
      }
    });

    // Update user attendance summary
    await user.updateAttendanceSummary();
  }

  return {
    purchasedCount: purchasedDates.length,
    purchasedDates,
    totalCost: purchasedDates.length * costPerDay,
    errors: errors.length > 0 ? errors : undefined
  };
};

/**
 * Track attendance missions for user
 * @param {string} userId - ID của người dùng
 * @returns {Promise<Object>} - Kết quả tracking missions
 */
const trackAttendanceMissions = async (userId) => {
  try {
    console.log('[Attendance Mission Tracking] Starting attendance mission tracking for user:', userId);

    // Get all active attendance missions
    const attendanceMissions = await Mission.find({
      status: true,
      $or: [
        { 'requirement.type': 'attendance' },
        { 'subMissions.requirement.type': 'attendance' }
      ]
    }).lean();

    if (!attendanceMissions.length) {
      console.log('[Attendance Mission Tracking] No active attendance missions found');
      return { tracked: 0, results: [] };
    }

    console.log('[Attendance Mission Tracking] Found attendance missions:', {
      count: attendanceMissions.length,
      missions: attendanceMissions.map(m => ({ id: m._id, title: m.title, type: m.type }))
    });

    const missionResults = [];

    // Process each mission
    for (const mission of attendanceMissions) {
      try {
        console.log('[Attendance Mission Tracking] Processing mission:', {
          missionId: mission._id,
          missionTitle: mission.title,
          missionType: mission.type,
          requirementType: mission.requirement.type
        });

        // Check if this mission should be tracked for this user
        const shouldTrack = await shouldTrackAttendanceMission(userId, mission);
        if (!shouldTrack) {
          console.log('[Attendance Mission Tracking] Mission should not be tracked for this user:', {
            missionId: mission._id,
            reason: 'Mission conditions not met'
          });
          continue;
        }

        // Track main mission progress if it's attendance type
        let progressResult = null;
        if (mission.requirement.type === 'attendance') {
          progressResult = await MissionProgress.updateProgress(
            userId,
            mission._id,
            1, // Increment by 1 for each attendance
            true // Increment mode
          );
        } else {
          // If main mission is not attendance type, get existing progress without updating
          const date = new Date();
          progressResult = await MissionProgress.findOne({
            user_id: userId,
            mission_id: mission._id,
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate()
          }) || {
            current_progress: 0,
            completed: false
          };
        }

        // Track sub-missions if any
        const subMissionResults = [];
        if (mission.subMissions && mission.subMissions.length > 0) {
          for (let subIndex = 0; subIndex < mission.subMissions.length; subIndex++) {
            const subMission = mission.subMissions[subIndex];

            // Check if this sub-mission should count for attendance
            if (subMission.requirement.type === 'attendance') {
              try {
                const subProgressResult = await MissionProgress.updateSubMissionProgress(
                  userId,
                  mission._id,
                  subIndex,
                  1, // Increment by 1 for each attendance
                  true // Increment mode
                );

                subMissionResults.push({
                  sub_mission_index: subIndex,
                  sub_mission_title: subMission.title,
                  sub_mission_type: subMission.requirement.type,
                  sub_mission_progress: subProgressResult.sub_progress.find(sp => sp.sub_mission_index === subIndex)
                });

                console.log('[Attendance Mission Tracking] Sub-mission progress updated:', {
                  missionId: mission._id,
                  subMissionIndex: subIndex,
                  subMissionTitle: subMission.title,
                  subMissionType: subMission.requirement.type
                });
              } catch (subError) {
                console.error('[Attendance Mission Tracking] Error updating sub-mission progress:', {
                  missionId: mission._id,
                  subMissionIndex: subIndex,
                  error: subError.message
                });
              }
            }
          }
        }

        missionResults.push({
          mission_id: mission._id,
          mission_title: mission.title,
          mission_type: mission.type,
          main_progress: progressResult,
          sub_missions: subMissionResults
        });

        console.log('[Attendance Mission Tracking] Mission tracking completed:', {
          missionId: mission._id,
          missionTitle: mission.title,
          mainProgress: progressResult?.current_progress || 0,
          subMissionsCount: subMissionResults.length
        });

      } catch (missionError) {
        console.error('[Attendance Mission Tracking] Error processing mission:', {
          missionId: mission._id,
          error: missionError.message
        });
        // Continue with other missions even if one fails
      }
    }

    console.log('[Attendance Mission Tracking] Attendance mission tracking completed:', {
      userId,
      totalMissions: attendanceMissions.length,
      trackedMissions: missionResults.length
    });

    return {
      tracked: missionResults.length,
      results: missionResults
    };

  } catch (error) {
    console.error('[Attendance Mission Tracking] Error in trackAttendanceMissions:', error);
    // Don't throw error to prevent attendance from failing
    return { tracked: 0, results: [], error: error.message };
  }
};

/**
 * Check if attendance mission should be tracked for user
 * @param {string} userId - ID của người dùng
 * @param {Object} mission - Mission object
 * @returns {Promise<boolean>} - Should track or not
 */
const shouldTrackAttendanceMission = async (userId, mission) => {
  try {
    // Get current time info
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const firstDayOfYear = new Date(currentYear, 0, 1);
    const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
    const currentWeek = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    // Build time query based on mission type
    let timeQuery = {};
    if (mission.type === 'daily') {
      timeQuery = { day: currentDay, month: currentMonth, year: currentYear };
    } else if (mission.type === 'weekly') {
      timeQuery = { week: currentWeek, year: currentYear };
    }

    // Check if there's already a progress record for this mission and time period
    const existingProgress = await MissionProgress.findOne({
      user_id: userId,
      mission_id: mission._id,
      ...timeQuery
    });

    // For attendance missions, we typically allow only one attendance per day
    // So we check if the mission is already completed for this time period
    if (existingProgress && existingProgress.completed) {
      console.log('[Attendance Mission Tracking] Mission already completed for this period:', {
        missionId: mission._id,
        missionTitle: mission.title,
        missionType: mission.type,
        timeQuery
      });
      return false;
    }

    console.log('[Attendance Mission Tracking] Mission conditions check passed:', {
      missionId: mission._id,
      missionTitle: mission.title,
      missionType: mission.type,
      hasExistingProgress: !!existingProgress,
      currentProgress: existingProgress?.current_progress || 0
    });

    return true;

  } catch (error) {
    console.error('[Attendance Mission Tracking] Error in shouldTrackAttendanceMission:', error);
    return false;
  }
};

module.exports = {
  checkIn,
  getAttendanceStatus,
  getAttendanceHistory,
  getAttendanceStats,
  getAttendanceCalendar,
  getAttendanceSummary,
  getAvailableMissedDays,
  buyMissedDays,
  trackAttendanceMissions
};
