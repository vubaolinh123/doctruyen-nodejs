/**
 * Attendance Reward Service
 * Contains business logic for attendance reward operations
 * Refactored to maintain backward compatibility while improving code structure
 * ✅ CRITICAL: Maintains all existing reward claiming logic that was fixed
 */

const User = require('../models/user');
const AttendanceReward = require('../models/attendanceReward');
const UserAttendanceMilestone = require('../models/userAttendanceReward'); // This is actually UserAttendanceMilestone
const Attendance = require('../models/attendance');
const Transaction = require('../models/transaction');
const SystemSettings = require('../models/systemSettings');
const { ApiError } = require('../utils/errorHandler');

/**
 * Get list of available rewards for user
 */
const getRewardsList = async (userId) => {
  console.log(`[AttendanceRewardService] Getting rewards list for user: ${userId}`);

  // Get user attendance stats
  const user = await User.findById(userId).populate('attendance_summary');
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  const userStats = user.attendance_summary || {
    current_streak: 0,
    total_days: 0
  };

  console.log(`[AttendanceRewardService] User stats: streak=${userStats.current_streak}, total=${userStats.total_days}`);

  // Get all rewards
  const rewards = await AttendanceReward.find({ is_active: true })
    .populate('permission_id', 'name description')
    .sort({ required_days: 1 });

  // Get current date info
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Get user's claimed rewards
  const claimedRewardsCurrentMonth = await UserAttendanceMilestone.getUserClaims(userId, {
    month: currentMonth,
    year: currentYear
  });

  const claimedRewardsAllTime = await UserAttendanceMilestone.getUserClaims(userId, {
    // No year filter for total rewards
  });

  // Create maps for quick lookup
  const claimedMonthlyMap = new Map();
  const claimedLifetimeSet = new Set();

  // Process current month claims for monthly rewards
  claimedRewardsCurrentMonth.forEach(claim => {
    if (claim.milestone_id) {
      const milestoneId = typeof claim.milestone_id === 'object' ? claim.milestone_id._id : claim.milestone_id;
      const key = `${milestoneId}_${claim.month}_${claim.year}`;
      claimedMonthlyMap.set(key, claim);
    }
  });

  // Process all-time claims for lifetime rewards
  claimedRewardsAllTime.forEach(claim => {
    if (claim.milestone_id) {
      const milestoneId = typeof claim.milestone_id === 'object' ? claim.milestone_id._id : claim.milestone_id;
      claimedLifetimeSet.add(milestoneId.toString());
    }
  });

  // Process rewards
  const monthlyRewards = [];
  const lifetimeRewards = [];

  rewards.forEach(reward => {
    const rewardObj = {
      _id: reward._id,
      title: reward.title,
      description: reward.description,
      type: reward.type,
      required_days: reward.required_days,
      reward_type: reward.reward_type,
      reward_value: reward.reward_value,
      permission_id: reward.permission_id,
      is_active: reward.is_active,
      canClaim: false,
      claimed: false,
      claimedAt: null,
      progress: 0
    };

    // Calculate progress and claim status
    if (reward.type === 'consecutive' || reward.type === 'monthly') {
      // For monthly rewards, use current month attendance
      const currentProgress = userStats.monthly_days || 0;
      rewardObj.progress = Math.min((currentProgress / reward.required_days) * 100, 100);
      rewardObj.canClaim = currentProgress >= reward.required_days;

      // Check if claimed in current month
      const claimKey = `${reward._id}_${currentMonth}_${currentYear}`;
      const claimed = claimedMonthlyMap.get(claimKey);
      if (claimed) {
        rewardObj.claimed = true;
        rewardObj.claimedAt = claimed.claimed_at;
        rewardObj.canClaim = false;
      }

      monthlyRewards.push(rewardObj);
    } else if (reward.type === 'total' || reward.type === 'lifetime') {
      rewardObj.progress = Math.min((userStats.total_days / reward.required_days) * 100, 100);
      rewardObj.canClaim = userStats.total_days >= reward.required_days;

      // Check if claimed lifetime
      const milestoneIdStr = reward._id.toString();
      if (claimedLifetimeSet.has(milestoneIdStr)) {
        const claimed = claimedRewardsAllTime.find(claim => {
          const claimMilestoneId = typeof claim.milestone_id === 'object' ? claim.milestone_id._id : claim.milestone_id;
          return claimMilestoneId.toString() === milestoneIdStr;
        });

        rewardObj.claimed = true;
        rewardObj.claimedAt = claimed?.claimed_at || null;
        rewardObj.canClaim = false;
      }

      lifetimeRewards.push(rewardObj);
    }
  });

  return {
    userStats,
    rewards: {
      monthly: monthlyRewards,
      lifetime: lifetimeRewards
    }
  };
};

/**
 * Claim a specific reward
 */
const claimReward = async (userId, rewardId) => {
  console.log(`[AttendanceRewardService] Claiming reward ${rewardId} for user ${userId}`);

  // Validate reward exists
  const reward = await AttendanceReward.findById(rewardId).populate('permission_id');
  if (!reward || !reward.is_active) {
    throw new ApiError(404, 'Không tìm thấy phần thưởng hoặc phần thưởng đã bị vô hiệu hóa');
  }

  // Get user and stats
  const user = await User.findById(userId).populate('attendance_summary');
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  const userStats = user.attendance_summary || {
    current_streak: 0,
    total_days: 0
  };

  // Check eligibility
  const isEligible = (reward.type === 'consecutive' || reward.type === 'monthly')
    ? (userStats.monthly_days || 0) >= reward.required_days
    : userStats.total_days >= reward.required_days;

  if (!isEligible) {
    const typeText = (reward.type === 'consecutive' || reward.type === 'monthly') ? 'trong tháng' : 'tổng cộng';
    throw new ApiError(400, `Bạn chưa đủ điều kiện nhận thưởng này. Cần ${reward.required_days} ngày ${typeText}`);
  }

  // Check if already claimed
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const hasAlreadyClaimed = await UserAttendanceMilestone.hasUserClaimed(
    userId,
    rewardId,
    reward.type,
    (reward.type === 'consecutive' || reward.type === 'monthly') ? currentMonth : null,
    (reward.type === 'consecutive' || reward.type === 'monthly') ? currentYear : null
  );

  if (hasAlreadyClaimed) {
    const timeframe = (reward.type === 'consecutive' || reward.type === 'monthly') ? 'trong tháng này' : 'rồi';
    throw new ApiError(400, `Bạn đã nhận thưởng này ${timeframe}`);
  }

  // Create claim data with all required fields
  const claimData = {
    user_id: userId,
    milestone_id: rewardId, // Required field
    claimed_at: now,
    month: (reward.type === 'consecutive' || reward.type === 'monthly') ? currentMonth : undefined,
    year: currentYear,
    milestone_type: reward.type === 'consecutive' ? 'monthly' : reward.type, // Required field: 'monthly' or 'lifetime'
    days_at_claim: (reward.type === 'consecutive' || reward.type === 'monthly')
      ? (userStats.monthly_days || 0)
      : userStats.total_days, // Required field
    reward_type: reward.reward_type,
    reward_value: reward.reward_value,
    permission_id: reward.permission_id || null,
    notes: `Nhận thưởng: ${reward.title}`
  };

  // Use database transaction for data consistency
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();

  let claim;
  try {
    await session.withTransaction(async () => {
      // Create claim record
      claim = new UserAttendanceMilestone(claimData);
      await claim.save({ session });

      // Handle coin rewards with proper transaction logging
      if (reward.reward_type === 'coin' && reward.reward_value > 0) {
        console.log(`[AttendanceRewardService] Processing coin reward: Adding ${reward.reward_value} coins to user ${userId}`);

        const userForUpdate = await User.findById(userId).session(session);
        if (!userForUpdate) {
          throw new Error('User not found during coin update');
        }

        // Prepare transaction metadata
        const description = `Phần thưởng điểm danh: ${reward.title}`;
        const metadata = {
          milestone_claim_id: claim._id,
          milestone_id: reward._id,
          milestone_type: reward.type,
          reward_type: reward.reward_type,
          reward_value: reward.reward_value,
          claimed_at: claim.claimed_at,
          month: claim.month,
          year: claim.year,
          milestone_title: reward.title
        };

        // Add coins with transaction logging
        await userForUpdate.addCoins(reward.reward_value, {
          description: description,
          metadata: metadata,
          type: 'attendance',
          createTransaction: true
        });

        console.log(`[AttendanceRewardService] ✅ Successfully added ${reward.reward_value} coins to user ${userId}`);
      }

      // Handle permission rewards
      if (reward.reward_type === 'permission' && reward.permission_id) {
        console.log(`[AttendanceRewardService] Processing permission reward for user ${userId}`);

        const UserPermission = require('../models/userPermission');

        // Check if user already has this permission
        const existingPermission = await UserPermission.findOne({
          user_id: userId,
          template_id: reward.permission_id
        }).session(session);

        if (!existingPermission) {
          await UserPermission.create([{
            user_id: userId,
            template_id: reward.permission_id,
            granted_at: claim.claimed_at,
            granted_by: 'system',
            reason: `Phần thưởng điểm danh: ${reward.title}`,
            metadata: {
              milestone_claim_id: claim._id,
              milestone_id: reward._id,
              milestone_type: reward.type
            }
          }], { session });

          console.log(`[AttendanceRewardService] ✅ Granted permission ${reward.permission_id} to user ${userId}`);
        }
      }
    });

    console.log(`[AttendanceRewardService] ✅ Successfully completed milestone claim transaction for user ${userId}`);
  } catch (error) {
    console.error(`[AttendanceRewardService] ❌ Transaction failed for milestone claim:`, error);
    throw new ApiError(500, `Lỗi khi xử lý phần thưởng: ${error.message}`);
  } finally {
    await session.endSession();
  }

  // Get populated claim for response
  const populatedClaim = await UserAttendanceMilestone.findById(claim._id)
    .populate('milestone_id', 'title description type required_days')
    .populate('permission_id', 'name description');

  // Get updated user data
  const updatedUser = await User.findById(userId).select('coin coin_total');

  // Create summary
  const claimSummary = populatedClaim.getSummary();

  // Prepare detailed response
  const response = {
    claim: populatedClaim,
    summary: claimSummary,
    reward: {
      title: reward.title,
      type: reward.type,
      reward_type: reward.reward_type,
      reward_value: reward.reward_value,
      rewardText: reward.reward_type === 'coin'
        ? `${reward.reward_value.toLocaleString()} xu`
        : `Quyền: ${reward.permission_id?.name || 'Đặc biệt'}`
    },
    user: {
      coin: updatedUser.coin,
      coin_total: updatedUser.coin_total
    },
    transaction: {
      completed: true,
      timestamp: claim.claimed_at,
      milestone_type: reward.type
    }
  };

  console.log(`[AttendanceRewardService] ✅ Claim completed successfully:`, {
    userId,
    milestoneId: reward._id,
    rewardType: reward.reward_type,
    rewardValue: reward.reward_value,
    newCoinBalance: updatedUser.coin
  });

  return response;
};

/**
 * Get pricing for buying missed days
 */
const getBuyMissedDaysPricing = async () => {
  const costPerDay = await SystemSettings.getSetting('missed_day_cost', 50);
  const maxBuybackDays = await SystemSettings.getSetting('max_buyback_days', 30);

  return {
    costPerDay,
    maxBuybackDays,
    currency: 'xu'
  };
};

/**
 * Get available missed days for purchase
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
 */
const buyMissedDays = async (userId, missedDates) => {
  console.log(`[AttendanceRewardService] buyMissedDays called for user ${userId}`);
  console.log(`[AttendanceRewardService] missedDates:`, missedDates);

  if (!Array.isArray(missedDates) || missedDates.length === 0) {
    throw new ApiError(400, 'Danh sách ngày không hợp lệ');
  }

  // Get settings
  const costPerDay = await SystemSettings.getSetting('missed_day_cost', 50);
  const maxBuybackDays = await SystemSettings.getSetting('max_buyback_days', 30);

  console.log(`[AttendanceRewardService] Settings: costPerDay=${costPerDay}, maxBuybackDays=${maxBuybackDays}`);

  // Validate dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oldestDate = new Date(today);
  oldestDate.setDate(oldestDate.getDate() - maxBuybackDays);

  console.log(`[AttendanceRewardService] Date range: ${oldestDate.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);

  const validDates = [];
  const errors = [];

  for (const dateStr of missedDates) {
    console.log(`[AttendanceRewardService] Processing date: ${dateStr}`);

    try {
      // ✅ Parse date correctly to avoid timezone issues
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month - 1 because JavaScript months start from 0
      date.setHours(0, 0, 0, 0);

      console.log(`[AttendanceRewardService] Parsed date: ${date.toISOString().split('T')[0]}`);

      // Check if date is in the past
      if (date >= today) {
        errors.push(`${dateStr}: Chỉ được mua điểm danh cho ngày trong quá khứ`);
        console.log(`[AttendanceRewardService] Date ${dateStr} is not in the past`);
        continue;
      }

      // Check if date is not too old
      if (date < oldestDate) {
        errors.push(`${dateStr}: Chỉ được mua điểm danh trong vòng ${maxBuybackDays} ngày gần nhất`);
        console.log(`[AttendanceRewardService] Date ${dateStr} is too old`);
        continue;
      }

      // Check if already attended this day
      const existingAttendance = await Attendance.findOne({
        user_id: userId,
        year: date.getFullYear(),
        month: date.getMonth(),
        day: date.getDate()
      });

      if (existingAttendance) {
        errors.push(`${dateStr}: Bạn đã điểm danh ngày này rồi`);
        console.log(`[AttendanceRewardService] Date ${dateStr} already attended`);
        continue;
      }

      validDates.push(date);
      console.log(`[AttendanceRewardService] Date ${dateStr} is valid`);

    } catch (error) {
      errors.push(`${dateStr}: Định dạng ngày không hợp lệ`);
      console.log(`[AttendanceRewardService] Error parsing date ${dateStr}:`, error.message);
    }
  }

  console.log(`[AttendanceRewardService] Valid dates: ${validDates.length}, Errors: ${errors.length}`);

  // If there are errors, return them
  if (errors.length > 0) {
    const error = new ApiError(400, 'Một số ngày không hợp lệ');
    error.details = { errors, validDatesCount: validDates.length };
    throw error;
  }

  // Check user balance
  const totalCost = validDates.length * costPerDay;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  if (user.coin < totalCost) {
    throw new ApiError(400, `Không đủ xu. Cần ${totalCost} xu, bạn có ${user.coin} xu`);
  }

  console.log(`[AttendanceRewardService] User has enough coins: ${user.coin} >= ${totalCost}`);

  // Process purchase
  const purchasedDates = [];
  const rewardPerDay = 10; // Reward for purchased days

  for (const date of validDates) {
    try {
      // Create purchased attendance
      const attendance = await Attendance.create({
        user_id: userId,
        date,
        status: 'purchased',
        reward: rewardPerDay,
        day: date.getDate(),
        month: date.getMonth(),
        year: date.getFullYear(),
        streak_count: 0, // Will be recalculated
        bonus_reward: 0,
        notes: `Mua điểm danh bù với ${costPerDay} xu, nhận ${rewardPerDay} xu thưởng`,
        attendance_time: new Date()
      });

      const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      purchasedDates.push(dateStr);

      console.log(`[AttendanceRewardService] Created attendance for ${dateStr}`);
    } catch (error) {
      console.error(`[AttendanceRewardService] Error creating attendance for ${date}:`, error);
    }
  }

  // Calculate costs and rewards
  const totalReward = purchasedDates.length * rewardPerDay;
  const netCost = totalCost - totalReward; // Net cost = 50 - 10 = 40 coins per day

  console.log(`[AttendanceRewardService] Cost calculation: totalCost=${totalCost}, totalReward=${totalReward}, netCost=${netCost}`);

  // Deduct net cost from user
  await User.findByIdAndUpdate(userId, {
    $inc: { coin: -netCost }
  });

  // Create transaction records
  try {
    // Expense transaction
    await Transaction.create({
      user_id: userId,
      transaction_id: `BUYBACK_${userId}_${Date.now()}`,
      description: `Mua điểm danh bù cho ${purchasedDates.length} ngày`,
      coin_change: -totalCost,
      type: 'attendance',
      direction: 'out',
      status: 'completed',
      reference_type: 'attendance',
      metadata: {
        purchased_dates: purchasedDates,
        cost_per_day: costPerDay,
        total_days: purchasedDates.length,
        transaction_type: 'attendance_buyback'
      }
    });

    // Reward transaction
    await Transaction.create({
      user_id: userId,
      transaction_id: `REWARD_${userId}_${Date.now()}`,
      description: `Thưởng điểm danh bù cho ${purchasedDates.length} ngày`,
      coin_change: totalReward,
      type: 'attendance',
      direction: 'in',
      status: 'completed',
      reference_type: 'attendance',
      metadata: {
        purchased_dates: purchasedDates,
        reward_per_day: rewardPerDay,
        total_days: purchasedDates.length,
        transaction_type: 'attendance_reward'
      }
    });

    console.log(`[AttendanceRewardService] Created transaction records`);
  } catch (transactionError) {
    console.error('[AttendanceRewardService] Error creating transactions:', transactionError);
  }

  // Recalculate attendance stats
  await recalculateAttendanceStats(userId);

  // Get updated user
  const updatedUser = await User.findById(userId).select('coin attendance_summary');

  console.log(`[AttendanceRewardService] Purchase completed successfully`);

  return {
    purchasedCount: purchasedDates.length,
    purchasedDates,
    totalCost,
    totalReward,
    netCost,
    rewardPerDay,
    remainingCoin: updatedUser.coin,
    newStats: updatedUser.attendance_summary
  };
};

/**
 * Recalculate attendance stats for user
 * @param {String} userId - User ID
 */
const recalculateAttendanceStats = async (userId) => {
  try {
    // Get all attendance records for user, sorted by date
    const attendances = await Attendance.find({
      user_id: userId,
      status: { $in: ['attended', 'purchased'] }
    }).sort({ year: 1, month: 1, day: 1 });

    console.log(`[AttendanceStats] Found ${attendances.length} valid attendance records for user ${userId}`);

    if (attendances.length === 0) {
      // Reset stats to 0 if no attendance
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      await User.findByIdAndUpdate(userId, {
        'attendance_summary.total_days': 0,
        'attendance_summary.monthly_days': 0,
        'attendance_summary.current_month': currentMonth,
        'attendance_summary.current_year': currentYear,
        'attendance_summary.current_streak': 0,
        'attendance_summary.longest_streak': 0,
        'attendance_summary.last_attendance': null
      });
      return;
    }

    // Calculate stats
    let totalDays = attendances.length;
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastDate = null;
    let lastAttendanceDate = null;

    // ✅ CORRECT LOGIC: Purchased = cumulative, Regular = consecutive + cumulative với purchased
    const purchasedAttendances = attendances.filter(att => att.status === 'purchased');
    const regularAttendances = attendances.filter(att => att.status === 'attended');

    console.log(`[AttendanceStats] Found ${purchasedAttendances.length} purchased + ${regularAttendances.length} regular attendances`);

    // ✅ STEP 1: Calculate purchased streak (cumulative - mỗi purchased day +1 bất kể gaps)
    let purchasedStreak = purchasedAttendances.length;
    console.log(`[AttendanceStats] Purchased streak: ${purchasedStreak} (cumulative)`);

    // ✅ STEP 2: Calculate regular streak (consecutive rules)
    let regularCurrentStreak = 0;
    let regularLongestStreak = 0;

    if (regularAttendances.length > 0) {
      let tempRegularStreak = 0;
      let lastRegularDate = null;

      // Process regular attendances to find consecutive streaks
      for (const attendance of regularAttendances) {
        const attendanceDate = new Date(attendance.year, attendance.month, attendance.day);
        attendanceDate.setHours(0, 0, 0, 0);

        if (lastRegularDate) {
          const dayDiff = (attendanceDate - lastRegularDate) / (1000 * 60 * 60 * 24);

          if (dayDiff === 1) {
            // Consecutive day
            tempRegularStreak++;
          } else if (dayDiff > 1) {
            // Gap found - update longest and reset temp
            regularLongestStreak = Math.max(regularLongestStreak, tempRegularStreak);
            tempRegularStreak = 1;
          }
        } else {
          tempRegularStreak = 1;
        }

        lastRegularDate = attendanceDate;
      }

      // Update longest streak with final temp streak
      regularLongestStreak = Math.max(regularLongestStreak, tempRegularStreak);

      // Check if regular streak is still active (within 1 day of today)
      if (lastRegularDate) {
        const daysSinceLastRegular = (today - lastRegularDate) / (1000 * 60 * 60 * 24);
        if (daysSinceLastRegular <= 1) {
          regularCurrentStreak = tempRegularStreak;
        } else {
          regularCurrentStreak = 0; // Regular streak expired
        }
      }

      console.log(`[AttendanceStats] Regular streak: current=${regularCurrentStreak}, longest=${regularLongestStreak}`);

      // Update last attendance date
      if (lastRegularDate) {
        lastAttendanceDate = lastRegularDate;
      }
    }

    // ✅ STEP 3: Set last attendance date from purchased if more recent
    if (purchasedAttendances.length > 0) {
      const lastPurchased = purchasedAttendances[purchasedAttendances.length - 1];
      const lastPurchasedDate = new Date(lastPurchased.year, lastPurchased.month, lastPurchased.day);
      lastPurchasedDate.setHours(0, 0, 0, 0);

      if (!lastAttendanceDate || lastPurchasedDate > lastAttendanceDate) {
        lastAttendanceDate = lastPurchasedDate;
      }
    }

    // ✅ STEP 4: Combine results - purchased (cumulative) + regular (consecutive)
    currentStreak = purchasedStreak + regularCurrentStreak;
    longestStreak = purchasedStreak + regularLongestStreak;
    tempStreak = currentStreak;

    console.log(`[AttendanceStats] Final cumulative results:`);
    console.log(`[AttendanceStats] - Purchased streak: ${purchasedStreak} (cumulative)`);
    console.log(`[AttendanceStats] - Regular current: ${regularCurrentStreak}, longest: ${regularLongestStreak}`);
    console.log(`[AttendanceStats] - Combined current: ${currentStreak} (${purchasedStreak}+${regularCurrentStreak})`);
    console.log(`[AttendanceStats] - Combined longest: ${longestStreak} (${purchasedStreak}+${regularLongestStreak})`);
    console.log(`[AttendanceStats] - Total days: ${attendances.length}`);
    console.log(`[AttendanceStats] - Last attendance: ${lastAttendanceDate?.toISOString().split('T')[0]}`);

    // Update longest streak with final temp streak
    longestStreak = Math.max(longestStreak, tempStreak);

    // ✅ STEP 5: Calculate monthly attendance for current month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const currentMonthAttendances = attendances.filter(att =>
      att.month === currentMonth && att.year === currentYear
    );

    const monthlyDays = currentMonthAttendances.length;

    console.log(`[AttendanceStats] Monthly calculation for ${currentMonth}/${currentYear}:`);
    console.log(`  - Found ${monthlyDays} attendance days in current month`);
    console.log(`  - Monthly attendances:`, currentMonthAttendances.map(att =>
      `${att.day}/${att.month + 1}/${att.year} (${att.status})`
    ));

    // Update user stats with monthly attendance included
    await User.findByIdAndUpdate(userId, {
      'attendance_summary.total_days': totalDays,
      'attendance_summary.monthly_days': monthlyDays,
      'attendance_summary.current_month': currentMonth,
      'attendance_summary.current_year': currentYear,
      'attendance_summary.current_streak': currentStreak,
      'attendance_summary.longest_streak': longestStreak,
      'attendance_summary.last_attendance': lastAttendanceDate
    });

    console.log(`[AttendanceStats] ✅ Recalculated for user ${userId}:`);
    console.log(`  - Total days: ${totalDays}`);
    console.log(`  - Monthly days: ${monthlyDays}`);
    console.log(`  - Current month/year: ${currentMonth}/${currentYear}`);
    console.log(`  - Current streak: ${currentStreak}`);
    console.log(`  - Longest streak: ${longestStreak}`);
    console.log(`  - Last attendance: ${lastAttendanceDate?.toISOString().split('T')[0]}`);

  } catch (error) {
    console.error('❌ Error recalculating attendance stats:', error);
    throw error;
  }
};

module.exports = {
  getRewardsList,
  claimReward,
  getBuyMissedDaysPricing,
  getAvailableMissedDays,
  buyMissedDays,
  recalculateAttendanceStats // ✅ Export the recalculation function
};
