/**
 * UserAttendanceReward Static Methods
 */

module.exports = function(schema) {
  /**
   * Tạo bản ghi nhận thưởng mới
   * @param {String} userId - ID user
   * @param {String} rewardId - ID mốc phần thưởng
   * @param {Object} rewardData - Dữ liệu phần thưởng (snapshot)
   * @param {Object} userStats - Stats của user tại thời điểm nhận thưởng
   * @returns {Promise<Object>} - Bản ghi đã tạo
   */
  schema.statics.createClaim = async function(userId, rewardId, rewardData, userStats) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Kiểm tra duplicate claim
    const existingClaim = await this.findOne({
      user_id: userId,
      reward_id: rewardId,
      month: currentMonth,
      year: currentYear
    });

    if (existingClaim) {
      throw new Error('Bạn đã nhận thưởng này trong tháng này rồi');
    }

    const claimData = {
      user_id: userId,
      reward_id: rewardId,
      claimed_at: now,
      month: currentMonth,
      year: currentYear,
      consecutive_days_at_claim: userStats.consecutiveDays || 0,
      total_days_at_claim: userStats.totalDays || 0,
      reward_type: rewardData.reward_type,
      reward_value: rewardData.reward_value || 0,
      permission_id: rewardData.permission_id || null,
      notes: `Nhận thưởng ${rewardData.title}`
    };

    // ✅ Use new + save() to ensure hooks are triggered
    const claim = new this(claimData);
    return claim.save();
  };

  /**
   * Kiểm tra xem user đã nhận thưởng này chưa
   * @param {String} userId - ID user
   * @param {String} rewardId - ID mốc phần thưởng
   * @param {String} rewardType - Loại phần thưởng ('consecutive' | 'total')
   * @param {Number} month - Tháng (chỉ cho consecutive)
   * @param {Number} year - Năm (chỉ cho consecutive)
   * @returns {Promise<Boolean>} - True nếu đã nhận
   */
  schema.statics.hasUserClaimed = async function(userId, rewardId, rewardType, month = null, year = null) {
    const query = {
      user_id: userId,
      reward_id: rewardId
    };

    // Với consecutive rewards, kiểm tra theo tháng/năm
    if (rewardType === 'consecutive' && month !== null && year !== null) {
      query.month = month;
      query.year = year;
    }

    const existingClaim = await this.findOne(query);
    return !!existingClaim;
  };

  /**
   * Lấy danh sách phần thưởng đã nhận của user
   * @param {String} userId - ID user
   * @param {Object} options - Tùy chọn query
   * @returns {Promise<Array>} - Danh sách phần thưởng đã nhận
   */
  schema.statics.getUserClaims = async function(userId, options = {}) {
    const {
      month = null,
      year = null,
      rewardType = null,
      limit = 50,
      skip = 0
    } = options;

    const query = { user_id: userId };

    if (month !== null) query.month = month;
    if (year !== null) query.year = year;
    if (rewardType) query.reward_type = rewardType;

    return this.find(query)
      .populate('reward_id', 'title description type required_days')
      .populate('permission_id', 'name description')
      .sort({ claimed_at: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
  };

  /**
   * Lấy thống kê phần thưởng của user
   * @param {String} userId - ID user
   * @returns {Promise<Object>} - Thống kê
   */
  schema.statics.getUserRewardStats = async function(userId) {
    const mongoose = require('mongoose');
    const pipeline = [
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalClaims: { $sum: 1 },
          totalCoins: {
            $sum: {
              $cond: [{ $eq: ['$reward_type', 'coin'] }, '$reward_value', 0]
            }
          },
          totalPermissions: {
            $sum: {
              $cond: [{ $eq: ['$reward_type', 'permission'] }, 1, 0]
            }
          },
          consecutiveClaims: {
            $sum: {
              $cond: [
                { $eq: ['$reward_type', 'consecutive'] },
                1,
                0
              ]
            }
          },
          totalClaims: {
            $sum: {
              $cond: [
                { $eq: ['$reward_type', 'total'] },
                1,
                0
              ]
            }
          },
          lastClaimedAt: { $max: '$claimed_at' }
        }
      }
    ];

    const result = await this.aggregate(pipeline);

    if (result.length === 0) {
      return {
        totalClaims: 0,
        totalCoins: 0,
        totalPermissions: 0,
        consecutiveClaims: 0,
        totalClaims: 0,
        lastClaimedAt: null
      };
    }

    return result[0];
  };

  /**
   * Lấy danh sách user đã nhận thưởng cụ thể
   * @param {String} rewardId - ID mốc phần thưởng
   * @param {Object} options - Tùy chọn query
   * @returns {Promise<Array>} - Danh sách user
   */
  schema.statics.getRewardClaimers = async function(rewardId, options = {}) {
    const {
      month = null,
      year = null,
      limit = 100,
      skip = 0
    } = options;

    const query = { reward_id: rewardId };
    if (month !== null) query.month = month;
    if (year !== null) query.year = year;

    return this.find(query)
      .populate('user_id', 'name email avatar')
      .sort({ claimed_at: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
  };

  /**
   * Xóa các bản ghi claim cũ (cleanup)
   * @param {Number} monthsToKeep - Số tháng muốn giữ lại
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.statics.cleanupOldClaims = async function(monthsToKeep = 12) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);

    return this.deleteMany({
      claimed_at: { $lt: cutoffDate }
    });
  };
};
