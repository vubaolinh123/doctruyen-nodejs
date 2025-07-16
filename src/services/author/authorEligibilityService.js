const User = require('../../models/user');
const Author = require('../../models/author');
const Attendance = require('../../models/attendance');
const MissionProgress = require('../../models/missionProgress');

/**
 * Service xử lý các tác vụ liên quan đến điều kiện đăng ký tác giả
 */
class AuthorEligibilityService {
  /**
   * Kiểm tra điều kiện đăng ký tác giả của user
   * @param {string} userId - ID của user
   * @returns {Object} Kết quả kiểm tra điều kiện
   */
  async checkEligibility(userId) {
    try {
      // Lấy thông tin user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Không tìm thấy user');
      }



      // Kiểm tra xem user đã có author record chưa
      const existingAuthor = await Author.userHasAuthorRecord(userId);

      // Nếu đã có author record, kiểm tra trạng thái
      if (existingAuthor) {
        let reason = '';
        if (existingAuthor.approvalStatus === 'approved') {
          reason = 'User đã là tác giả được phê duyệt';
        } else if (existingAuthor.approvalStatus === 'pending') {
          reason = 'User đã đăng ký và đang chờ phê duyệt';
        } else if (existingAuthor.approvalStatus === 'rejected') {
          reason = 'Đơn đăng ký tác giả đã bị từ chối';
        }

        // Vẫn trả về thông tin chi tiết để user biết tiến độ
        const [attendanceCheck, missionCheck, emailCheck, coinCheck, accountCheck] = await Promise.all([
          this.checkAttendanceRequirement(userId),
          this.checkMissionRequirement(userId),
          this.checkEmailVerification(user),
          this.checkCoinRequirement(user),
          this.checkAccountStatus(user)
        ]);

        return {
          eligible: false,
          reason,
          requirements: {
            attendance: attendanceCheck,
            missions: missionCheck,
            emailVerified: emailCheck,
            coins: coinCheck,
            accountStatus: accountCheck,
            alreadyAuthor: existingAuthor.approvalStatus
          },
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            coins: user.coin || user.coins || 0
          },
          authorStatus: {
            status: existingAuthor.approvalStatus,
            submittedAt: existingAuthor.createdAt,
            reviewedAt: existingAuthor.approvalDate,
            rejectionReason: existingAuthor.rejectionReason
          }
        };
      }

      // Kiểm tra các điều kiện
      const [
        attendanceCheck,
        missionCheck,
        emailCheck,
        coinCheck,
        accountCheck
      ] = await Promise.all([
        this.checkAttendanceRequirement(userId),
        this.checkMissionRequirement(userId),
        this.checkEmailVerification(user),
        this.checkCoinRequirement(user),
        this.checkAccountStatus(user)
      ]);

      const requirements = {
        attendance: attendanceCheck,
        missions: missionCheck,
        emailVerified: emailCheck,
        coins: coinCheck,
        accountStatus: accountCheck,
        alreadyAuthor: !!existingAuthor
      };

      // Kiểm tra tổng thể - nếu đã là author thì không eligible để đăng ký lại
      const eligible = !existingAuthor &&
                      attendanceCheck.met &&
                      missionCheck.met &&
                      emailCheck.met &&
                      coinCheck.met &&
                      accountCheck.met;

      const result = {
        eligible,
        requirements,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          coins: user.coin || user.coins || 0
        }
      };

      if (!eligible) {
        if (existingAuthor) {
          result.reason = 'User đã là tác giả';
        } else {
          const missingRequirements = [];
          if (!attendanceCheck.met) missingRequirements.push('điểm danh');
          if (!missionCheck.met) missingRequirements.push('nhiệm vụ');
          if (!emailCheck.met) missingRequirements.push('xác thực email');
          if (!coinCheck.met) missingRequirements.push('xu');
          if (!accountCheck.met) missingRequirements.push('trạng thái tài khoản');

          result.reason = `Chưa đủ điều kiện: ${missingRequirements.join(', ')}`;
        }
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Kiểm tra điều kiện điểm danh (≥7 lần)
   * @param {string} userId - ID của user
   * @returns {Object} Kết quả kiểm tra điểm danh
   */
  async checkAttendanceRequirement(userId) {
    try {
      const attendanceCount = await Attendance.countDocuments({
        user_id: userId,
        status: 'attended'
      });

      const required = 7;
      const met = attendanceCount >= required;

      return {
        met,
        current: attendanceCount,
        required,
        description: `Điểm danh ít nhất ${required} lần`
      };
    } catch (error) {
      return {
        met: false,
        current: 0,
        required: 7,
        description: 'Điểm danh ít nhất 7 lần',
        error: error.message
      };
    }
  }

  /**
   * Kiểm tra điều kiện nhiệm vụ (≥7 nhiệm vụ hoàn thành)
   * @param {string} userId - ID của user
   * @returns {Object} Kết quả kiểm tra nhiệm vụ
   */
  async checkMissionRequirement(userId) {
    try {
      const completedMissions = await MissionProgress.countDocuments({
        user_id: userId,
        completed: true,
        rewarded: true
      });

      const required = 7;
      const met = completedMissions >= required;

      return {
        met,
        current: completedMissions,
        required,
        description: `Hoàn thành ít nhất ${required} nhiệm vụ`
      };
    } catch (error) {
      return {
        met: false,
        current: 0,
        required: 7,
        description: 'Hoàn thành ít nhất 7 nhiệm vụ',
        error: error.message
      };
    }
  }

  /**
   * Kiểm tra điều kiện xác thực email
   * @param {Object} user - Thông tin user
   * @returns {Object} Kết quả kiểm tra email
   */
  async checkEmailVerification(user) {
    // Nếu là Google OAuth hoặc user đã là author thì coi như đã verify email
    const isGoogleAuth = user.accountType === 'google';
    const isEmailVerified = user.email_verified === true;
    const isAuthor = user.role === 'author';
    const met = isEmailVerified || isGoogleAuth || isAuthor;

    return {
      met,
      current: met,
      required: true,
      description: 'Email phải được xác thực'
    };
  }

  /**
   * Kiểm tra điều kiện xu (≥5000 xu)
   * @param {Object} user - Thông tin user
   * @returns {Object} Kết quả kiểm tra xu
   */
  async checkCoinRequirement(user) {
    const currentCoins = user.coin || user.coins || 0;
    const required = 5000;
    const met = currentCoins >= required;

    return {
      met,
      current: currentCoins,
      required,
      description: `Có ít nhất ${required} xu (phí đăng ký)`
    };
  }

  /**
   * Kiểm tra trạng thái tài khoản
   * @param {Object} user - Thông tin user
   * @returns {Object} Kết quả kiểm tra trạng thái tài khoản
   */
  async checkAccountStatus(user) {
    const isActive = user.isActive === true;
    const isNotBanned = user.status !== 'banned';
    const met = isActive && isNotBanned;

    // Determine current status as string
    let currentStatus = 'unknown';
    if (!isActive) {
      currentStatus = 'inactive';
    } else if (user.status === 'banned') {
      currentStatus = 'banned';
    } else if (user.status === 'active') {
      currentStatus = 'active';
    } else {
      currentStatus = user.status || 'unknown';
    }

    return {
      met,
      current: currentStatus,
      required: {
        isActive: true,
        status: 'active'
      },
      description: 'Tài khoản phải đang hoạt động và không bị khóa'
    };
  }

  /**
   * Lấy thống kê tổng quan về điều kiện đăng ký tác giả
   * @returns {Object} Thống kê tổng quan
   */
  async getEligibilityStats() {
    try {
      const totalUsers = await User.countDocuments({ isActive: true });
      const totalAuthors = await Author.countDocuments({ authorType: 'system' });
      
      // Đếm users đủ điều kiện cơ bản (chưa kiểm tra chi tiết)
      const eligibleUsers = await User.countDocuments({
        isActive: true,
        email_verified: true,
        coin: { $gte: 5000 }, // Use 'coin' field (singular)
        status: { $ne: 'banned' }
      });

      return {
        totalUsers,
        totalAuthors,
        eligibleUsers,
        conversionRate: totalUsers > 0 ? (totalAuthors / totalUsers * 100).toFixed(2) : 0
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthorEligibilityService();
