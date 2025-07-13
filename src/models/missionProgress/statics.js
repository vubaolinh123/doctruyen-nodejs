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

    // Kiểm tra hoàn thành - FIXED: Xem xét cả nhiệm vụ con
    const isMainRequirementMet = missionProgress.current_progress >= mission.requirement.count;

    if (isMainRequirementMet && !missionProgress.completed) {
      // Kiểm tra xem có nhiệm vụ con không
      if (mission.subMissions && mission.subMissions.length > 0) {
        // Nếu có nhiệm vụ con, kiểm tra tất cả nhiệm vụ con đã hoàn thành chưa
        const allSubMissionsCompleted = mission.subMissions.every((_, index) => {
          const subProgress = missionProgress.sub_progress.find(sp => sp.sub_mission_index === index);
          return subProgress && subProgress.completed;
        });

        // Chỉ đánh dấu hoàn thành khi cả nhiệm vụ chính VÀ tất cả nhiệm vụ con đều hoàn thành
        if (allSubMissionsCompleted) {
          missionProgress.completed = true;
          missionProgress.completed_at = new Date();
          console.log('[MissionProgress] Mission completed - both main and all sub-missions fulfilled:', {
            missionId: mission._id,
            missionTitle: mission.title,
            mainProgress: missionProgress.current_progress,
            mainRequired: mission.requirement.count,
            subMissionsCount: mission.subMissions.length,
            completedSubMissions: missionProgress.sub_progress.filter(sp => sp.completed).length
          });
        } else {
          console.log('[MissionProgress] Main requirement met but sub-missions not completed:', {
            missionId: mission._id,
            missionTitle: mission.title,
            mainProgress: missionProgress.current_progress,
            mainRequired: mission.requirement.count,
            subMissionsCount: mission.subMissions.length,
            completedSubMissions: missionProgress.sub_progress.filter(sp => sp.completed).length,
            pendingSubMissions: mission.subMissions.length - missionProgress.sub_progress.filter(sp => sp.completed).length
          });
        }
      } else {
        // Nếu không có nhiệm vụ con, chỉ cần kiểm tra nhiệm vụ chính
        missionProgress.completed = true;
        missionProgress.completed_at = new Date();
        console.log('[MissionProgress] Mission completed - main requirement fulfilled (no sub-missions):', {
          missionId: mission._id,
          missionTitle: mission.title,
          mainProgress: missionProgress.current_progress,
          mainRequired: mission.requirement.count
        });
      }
    }

    await missionProgress.save();
    return missionProgress;
  };

  /**
   * Cập nhật tiến trình nhiệm vụ con
   * @param {string} userId - ID của người dùng
   * @param {string} missionId - ID của nhiệm vụ
   * @param {number} subMissionIndex - Chỉ số của nhiệm vụ con
   * @param {number} progress - Tiến trình cần cập nhật
   * @param {boolean} increment - Tăng tiến trình (true) hoặc gán giá trị mới (false)
   * @returns {Promise<Object>} - Tiến trình sau khi cập nhật
   */
  schema.statics.updateSubMissionProgress = async function(userId, missionId, subMissionIndex, progress, increment = true) {
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

    if (!mission.subMissions || mission.subMissions.length <= subMissionIndex) {
      throw new Error('Nhiệm vụ con không tồn tại');
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
        week: mission.type === 'weekly' ? week : 0,
        sub_progress: []
      });
    }

    // Tìm hoặc tạo tiến trình nhiệm vụ con
    let subProgress = missionProgress.sub_progress.find(sp => sp.sub_mission_index === subMissionIndex);

    if (!subProgress) {
      subProgress = {
        sub_mission_index: subMissionIndex,
        current_progress: 0,
        completed: false
      };
      missionProgress.sub_progress.push(subProgress);
    }

    // Cập nhật tiến trình nhiệm vụ con
    const subProgressIndex = missionProgress.sub_progress.findIndex(sp => sp.sub_mission_index === subMissionIndex);

    if (increment) {
      missionProgress.sub_progress[subProgressIndex].current_progress += progress;
    } else {
      missionProgress.sub_progress[subProgressIndex].current_progress = progress;
    }

    // Kiểm tra hoàn thành nhiệm vụ con
    const requiredCount = mission.subMissions[subMissionIndex].requirement.count;
    if (missionProgress.sub_progress[subProgressIndex].current_progress >= requiredCount) {
      missionProgress.sub_progress[subProgressIndex].completed = true;
    }

    // Kiểm tra hoàn thành toàn bộ nhiệm vụ
    const isMainRequirementMet = missionProgress.current_progress >= mission.requirement.count;
    const allSubMissionsCompleted = mission.subMissions.every((_, index) => {
      const subProg = missionProgress.sub_progress.find(sp => sp.sub_mission_index === index);
      return subProg && subProg.completed;
    });

    if (isMainRequirementMet && allSubMissionsCompleted && !missionProgress.completed) {
      missionProgress.completed = true;
      missionProgress.completed_at = new Date();
      console.log('[MissionProgress] Mission completed - both main and all sub-missions fulfilled:', {
        missionId: mission._id,
        missionTitle: mission.title,
        mainProgress: missionProgress.current_progress,
        mainRequired: mission.requirement.count,
        subMissionsCount: mission.subMissions.length,
        completedSubMissions: missionProgress.sub_progress.filter(sp => sp.completed).length
      });
    }

    await missionProgress.save();
    return missionProgress;
  };

  /**
   * Kiểm tra xem nhiệm vụ có hoàn thành không (bao gồm cả nhiệm vụ con)
   * @param {string} userId - ID của người dùng
   * @param {string} missionId - ID của nhiệm vụ
   * @returns {Promise<Object>} - Thông tin hoàn thành nhiệm vụ
   */
  schema.statics.validateMissionCompletion = async function(userId, missionId) {
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    // Lấy thông tin nhiệm vụ
    const Mission = mongoose.model('Mission');
    const mission = await Mission.findById(missionId);

    if (!mission) {
      throw new Error('Nhiệm vụ không tồn tại');
    }

    // Tìm tiến trình nhiệm vụ
    const missionProgress = await this.findOne({
      user_id: userId,
      mission_id: missionId,
      year: year,
      month: month,
      day: day
    });

    if (!missionProgress) {
      return {
        completed: false,
        mainRequirementMet: false,
        subMissionsCompleted: false,
        details: {
          mainProgress: 0,
          mainRequired: mission.requirement.count,
          subMissions: mission.subMissions?.map((sub, index) => ({
            index,
            title: sub.title,
            progress: 0,
            required: sub.requirement.count,
            completed: false
          })) || []
        }
      };
    }

    // Kiểm tra nhiệm vụ chính
    const isMainRequirementMet = missionProgress.current_progress >= mission.requirement.count;

    // Kiểm tra nhiệm vụ con
    let allSubMissionsCompleted = true;
    const subMissionDetails = [];

    if (mission.subMissions && mission.subMissions.length > 0) {
      for (let index = 0; index < mission.subMissions.length; index++) {
        const subMission = mission.subMissions[index];
        const subProgress = missionProgress.sub_progress.find(sp => sp.sub_mission_index === index);

        const subCompleted = subProgress && subProgress.completed;
        if (!subCompleted) {
          allSubMissionsCompleted = false;
        }

        subMissionDetails.push({
          index,
          title: subMission.title,
          progress: subProgress?.current_progress || 0,
          required: subMission.requirement.count,
          completed: subCompleted
        });
      }
    }

    const isFullyCompleted = isMainRequirementMet && allSubMissionsCompleted;

    return {
      completed: isFullyCompleted,
      mainRequirementMet: isMainRequirementMet,
      subMissionsCompleted: allSubMissionsCompleted,
      details: {
        mainProgress: missionProgress.current_progress,
        mainRequired: mission.requirement.count,
        subMissions: subMissionDetails
      }
    };
  };
};

module.exports = setupStatics;
