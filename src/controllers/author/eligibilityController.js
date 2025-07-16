const authorEligibilityService = require('../../services/author/authorEligibilityService');

/**
 * Controller xử lý các API liên quan đến điều kiện đăng ký tác giả
 */

/**
 * Kiểm tra điều kiện đăng ký tác giả của user hiện tại
 * @route GET /api/authors/eligibility/check
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.checkEligibility = async (req, res) => {
  try {
    // Lấy user ID từ token (đã được xác thực bởi middleware)
    const userId = req.user.id;

    const result = await authorEligibilityService.checkEligibility(userId);

    return res.json({
      success: true,
      message: result.eligible ? 'Đủ điều kiện đăng ký tác giả' : 'Chưa đủ điều kiện đăng ký tác giả',
      data: result
    });
  } catch (error) {
    console.error('Lỗi khi kiểm tra điều kiện đăng ký tác giả:', error);
    
    if (error.message === 'Không tìm thấy user') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin user'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Kiểm tra điều kiện đăng ký tác giả của user cụ thể (Admin only)
 * @route GET /api/authors/eligibility/check/:userId
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.checkUserEligibility = async (req, res) => {
  try {
    const { userId } = req.params;

    // Kiểm tra quyền admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể kiểm tra điều kiện của user khác'
      });
    }

    const result = await authorEligibilityService.checkEligibility(userId);

    return res.json({
      success: true,
      message: result.eligible ? 'User đủ điều kiện đăng ký tác giả' : 'User chưa đủ điều kiện đăng ký tác giả',
      data: result
    });
  } catch (error) {
    console.error('Lỗi khi kiểm tra điều kiện đăng ký tác giả:', error);
    
    if (error.message === 'Không tìm thấy user') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin user'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy thống kê tổng quan về điều kiện đăng ký tác giả (Admin only)
 * @route GET /api/authors/eligibility/stats
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getEligibilityStats = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem thống kê'
      });
    }

    const stats = await authorEligibilityService.getEligibilityStats();

    return res.json({
      success: true,
      message: 'Lấy thống kê thành công',
      data: stats
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê điều kiện đăng ký tác giả:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy chi tiết các yêu cầu để đăng ký tác giả
 * @route GET /api/authors/eligibility/requirements
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRequirements = async (req, res) => {
  try {
    const requirements = {
      attendance: {
        required: 7,
        description: 'Điểm danh ít nhất 7 lần'
      },
      missions: {
        required: 7,
        description: 'Hoàn thành ít nhất 7 nhiệm vụ hàng ngày hoặc hàng tuần'
      },
      emailVerified: {
        required: true,
        description: 'Email phải được xác thực'
      },
      coins: {
        required: 5000,
        description: 'Có ít nhất 5,000 xu (phí đăng ký tác giả)'
      },
      accountStatus: {
        required: 'active',
        description: 'Tài khoản phải đang hoạt động và không bị khóa'
      }
    };

    // If user is authenticated, include their current progress
    let userProgress = null;

    if (req.user && req.user.id) {
      try {
        const authorEligibilityService = require('../../services/author/authorEligibilityService');
        const eligibilityResult = await authorEligibilityService.checkEligibility(req.user.id);

        if (eligibilityResult && eligibilityResult.requirements) {
          userProgress = {
            attendance: {
              current: eligibilityResult.requirements.attendance.current,
              met: eligibilityResult.requirements.attendance.met
            },
            missions: {
              current: eligibilityResult.requirements.missions.current,
              met: eligibilityResult.requirements.missions.met
            },
            emailVerified: {
              current: eligibilityResult.requirements.emailVerified.current,
              met: eligibilityResult.requirements.emailVerified.met
            },
            coins: {
              current: eligibilityResult.requirements.coins.current,
              met: eligibilityResult.requirements.coins.met
            },
            accountStatus: {
              current: eligibilityResult.requirements.accountStatus.current,
              met: eligibilityResult.requirements.accountStatus.met
            },
            overall: {
              eligible: eligibilityResult.eligible,
              completedRequirements: Object.values(eligibilityResult.requirements)
                .filter(req => req && req.met === true).length,
              totalRequirements: 5
            }
          };
        }
      } catch (error) {
        console.error('Error fetching user progress:', error);
        // Continue without user progress if there's an error
      }
    }

    return res.json({
      success: true,
      message: 'Lấy yêu cầu đăng ký tác giả thành công',
      data: {
        requirements,
        userProgress,
        note: 'Tất cả các yêu cầu trên phải được đáp ứng để có thể đăng ký trở thành tác giả'
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy yêu cầu đăng ký tác giả:', error);

    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};
