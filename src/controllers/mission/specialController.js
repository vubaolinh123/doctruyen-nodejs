/**
 * Controller đặc biệt cho Mission
 * Xử lý các thao tác nâng cao và đặc biệt
 */
const Mission = require('../../models/mission');
const MissionProgress = require('../../models/missionProgress');
const { handleError } = require('../../utils/errorHandler');

/**
 * Lấy danh sách nhiệm vụ hàng ngày
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getDailyMissions = async (req, res) => {
  try {
    const { status } = req.query;
    
    // Xây dựng query
    const query = { type: 'daily' };
    
    // Lọc theo trạng thái nếu có
    if (status !== undefined) {
      query.status = status === 'true';
    }
    
    // Thực hiện query
    const missions = await Mission.find(query).sort({ order: 1, rarity: 1 });
    
    res.json({
      success: true,
      missions
    });
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Lấy danh sách nhiệm vụ hàng tuần
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getWeeklyMissions = async (req, res) => {
  try {
    const { status } = req.query;
    
    // Xây dựng query
    const query = { type: 'weekly' };
    
    // Lọc theo trạng thái nếu có
    if (status !== undefined) {
      query.status = status === 'true';
    }
    
    // Thực hiện query
    const missions = await Mission.find(query).sort({ order: 1, rarity: 1 });
    
    res.json({
      success: true,
      missions
    });
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Bật/tắt trạng thái nhiệm vụ
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Tìm nhiệm vụ
    const mission = await Mission.findById(id);
    
    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhiệm vụ'
      });
    }
    
    // Đảo ngược trạng thái
    mission.status = !mission.status;
    
    // Lưu vào database
    await mission.save();
    
    res.json({
      success: true,
      message: `Đã ${mission.status ? 'bật' : 'tắt'} trạng thái nhiệm vụ`,
      mission
    });
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Lấy thống kê về nhiệm vụ
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getMissionStats = async (req, res) => {
  try {
    // Đếm tổng số nhiệm vụ
    const totalMissions = await Mission.countDocuments();
    
    // Đếm số nhiệm vụ hàng ngày
    const dailyMissions = await Mission.countDocuments({ type: 'daily' });
    
    // Đếm số nhiệm vụ hàng tuần
    const weeklyMissions = await Mission.countDocuments({ type: 'weekly' });
    
    // Đếm số nhiệm vụ theo độ hiếm
    const commonMissions = await Mission.countDocuments({ rarity: 'common' });
    const uncommonMissions = await Mission.countDocuments({ rarity: 'uncommon' });
    const rareMissions = await Mission.countDocuments({ rarity: 'rare' });
    const epicMissions = await Mission.countDocuments({ rarity: 'epic' });
    
    // Đếm số nhiệm vụ đang hoạt động
    const activeMissions = await Mission.countDocuments({ status: true });
    
    res.json({
      success: true,
      stats: {
        total: totalMissions,
        daily: dailyMissions,
        weekly: weeklyMissions,
        rarity: {
          common: commonMissions,
          uncommon: uncommonMissions,
          rare: rareMissions,
          epic: epicMissions
        },
        active: activeMissions,
        inactive: totalMissions - activeMissions
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Lấy tiến trình nhiệm vụ của người dùng
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getUserMissionProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;
    
    // Lấy ngày hiện tại
    const today = new Date();
    
    // Nếu có type, lấy tiến trình theo loại
    if (type === 'daily') {
      const dailyProgress = await MissionProgress.getDailyProgress(userId, today);
      
      return res.json({
        success: true,
        progress: dailyProgress
      });
    } else if (type === 'weekly') {
      const weeklyProgress = await MissionProgress.getWeeklyProgress(userId, today);
      
      return res.json({
        success: true,
        progress: weeklyProgress
      });
    }
    
    // Nếu không có type, lấy cả hai
    const dailyProgress = await MissionProgress.getDailyProgress(userId, today);
    const weeklyProgress = await MissionProgress.getWeeklyProgress(userId, today);
    
    res.json({
      success: true,
      progress: {
        daily: dailyProgress,
        weekly: weeklyProgress
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  getDailyMissions,
  getWeeklyMissions,
  toggleStatus,
  getMissionStats,
  getUserMissionProgress
};
