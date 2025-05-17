const mongoose = require('mongoose');

/**
 * Định nghĩa các static methods cho MissionProgress model
 * @param {Object} schema - Schema của MissionProgress model
 */
const setupStatics = (schema) => {
  /**
   * Lấy tiến trình nhiệm vụ hàng ngày của người dùng
   * @param {string} userId - ID của người dùng
   * @param {Date} date - Ngày cần lấy tiến trình
   * @returns {Promise<Array>} - Danh sách tiến trình nhiệm vụ hàng ngày
   */
  schema.statics.getDailyProgress = async function(userId, date = new Date()) {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    const Mission = mongoose.model('Mission');
    
    // Lấy danh sách nhiệm vụ hàng ngày
    const dailyMissions = await Mission.getDailyMissions();
    
    // Lấy tiến trình của người dùng
    const progress = await this.find({
      user_id: userId,
      day: day,
      month: month,
      year: year
    }).populate('mission_id');
    
    // Lọc ra chỉ tiến trình của nhiệm vụ hàng ngày
    const dailyProgress = progress.filter(p => p.mission_id && p.mission_id.type === 'daily');
    
    // Tạo map để dễ truy cập
    const progressMap = new Map();
    dailyProgress.forEach(p => {
      progressMap.set(p.mission_id._id.toString(), p);
    });
    
    // Kết hợp nhiệm vụ và tiến trình
    return dailyMissions.map(mission => {
      const missionId = mission._id.toString();
      const userProgress = progressMap.get(missionId);
      
      if (userProgress) {
        return userProgress;
      } else {
        // Tạo tiến trình mới nếu chưa có
        return {
          user_id: userId,
          mission_id: mission,
          current_progress: 0,
          completed: false,
          rewarded: false,
          day: day,
          month: month,
          year: year
        };
      }
    });
  };

  /**
   * Lấy tiến trình nhiệm vụ hàng tuần của người dùng
   * @param {string} userId - ID của người dùng
   * @param {Date} date - Ngày cần lấy tiến trình
   * @returns {Promise<Array>} - Danh sách tiến trình nhiệm vụ hàng tuần
   */
  schema.statics.getWeeklyProgress = async function(userId, date = new Date()) {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Tính tuần trong năm
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    
    const Mission = mongoose.model('Mission');
    
    // Lấy danh sách nhiệm vụ hàng tuần
    const weeklyMissions = await Mission.getWeeklyMissions();
    
    // Lấy tiến trình của người dùng
    const progress = await this.find({
      user_id: userId,
      year: year,
      week: week
    }).populate('mission_id');
    
    // Lọc ra chỉ tiến trình của nhiệm vụ hàng tuần
    const weeklyProgress = progress.filter(p => p.mission_id && p.mission_id.type === 'weekly');
    
    // Tạo map để dễ truy cập
    const progressMap = new Map();
    weeklyProgress.forEach(p => {
      progressMap.set(p.mission_id._id.toString(), p);
    });
    
    // Kết hợp nhiệm vụ và tiến trình
    return weeklyMissions.map(mission => {
      const missionId = mission._id.toString();
      const userProgress = progressMap.get(missionId);
      
      if (userProgress) {
        return userProgress;
      } else {
        // Tạo tiến trình mới nếu chưa có
        return {
          user_id: userId,
          mission_id: mission,
          current_progress: 0,
          completed: false,
          rewarded: false,
          day: day,
          month: month,
          year: year,
          week: week
        };
      }
    });
  };

  /**
   * Cập nhật tiến trình nhiệm vụ
   * @param {string} userId - ID của người dùng
   * @param {string} missionId - ID của nhiệm vụ
   * @param {number} progress - Tiến trình cần cập nhật
   * @param {boolean} increment - Tăng tiến trình (true) hoặc gán giá trị mới (false)
   * @returns {Promise<Object>} - Tiến trình sau khi cập nhật
   */
  schema.statics.updateProgress = async function(userId, missionId, progress, increment = true) {
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Tính tuần trong năm
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    
    // Lấy thông tin nhiệm vụ
    const Mission = mongoose.model('Mission');
    const mission = await Mission.findById(missionId);
    
    if (!mission) {
      throw new Error('Nhiệm vụ không tồn tại');
    }
    
    // Tìm hoặc tạo tiến trình
    let missionProgress = await this.findOne({
      user_id: userId,
      mission_id: missionId,
      year: year,
      month: month,
      day: day
    });
    
    if (!missionProgress) {
      missionProgress = new this({
        user_id: userId,
        mission_id: missionId,
        current_progress: 0,
        completed: false,
        rewarded: false,
        day: day,
        month: month,
        year: year,
        week: mission.type === 'weekly' ? week : 0
      });
    }
    
    // Cập nhật tiến trình
    if (increment) {
      missionProgress.current_progress += progress;
    } else {
      missionProgress.current_progress = progress;
    }
    
    // Kiểm tra hoàn thành
    if (missionProgress.current_progress >= mission.requirement.count && !missionProgress.completed) {
      missionProgress.completed = true;
      missionProgress.completed_at = new Date();
    }
    
    await missionProgress.save();
    return missionProgress;
  };
};

module.exports = setupStatics;
