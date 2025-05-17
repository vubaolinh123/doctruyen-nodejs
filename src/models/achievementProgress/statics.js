const mongoose = require('mongoose');

/**
 * Định nghĩa các static methods cho AchievementProgress model
 * @param {Object} schema - Schema của AchievementProgress model
 */
const setupStatics = (schema) => {
  /**
   * Lấy tiến trình thành tựu của người dùng
   * @param {string} userId - ID của người dùng
   * @returns {Promise<Array>} - Danh sách tiến trình thành tựu
   */
  schema.statics.getUserProgress = async function(userId) {
    return this.find({
      user_id: userId
    }).populate('achievement_id');
  };

  /**
   * Lấy tiến trình thành tựu đã hoàn thành của người dùng
   * @param {string} userId - ID của người dùng
   * @returns {Promise<Array>} - Danh sách tiến trình thành tựu đã hoàn thành
   */
  schema.statics.getCompletedAchievements = async function(userId) {
    return this.find({
      user_id: userId,
      completed: true
    }).populate('achievement_id');
  };

  /**
   * Lấy tiến trình thành tựu chưa hoàn thành của người dùng
   * @param {string} userId - ID của người dùng
   * @returns {Promise<Array>} - Danh sách tiến trình thành tựu chưa hoàn thành
   */
  schema.statics.getIncompleteAchievements = async function(userId) {
    return this.find({
      user_id: userId,
      completed: false
    }).populate('achievement_id');
  };

  /**
   * Lấy tiến trình thành tựu đã hoàn thành nhưng chưa nhận thưởng của người dùng
   * @param {string} userId - ID của người dùng
   * @returns {Promise<Array>} - Danh sách tiến trình thành tựu đã hoàn thành nhưng chưa nhận thưởng
   */
  schema.statics.getPendingRewards = async function(userId) {
    return this.find({
      user_id: userId,
      completed: true,
      rewarded: false
    }).populate('achievement_id');
  };

  /**
   * Lấy tiến trình thành tựu theo loại thành tựu
   * @param {string} userId - ID của người dùng
   * @param {string} category - Loại thành tựu
   * @returns {Promise<Array>} - Danh sách tiến trình thành tựu
   */
  schema.statics.getProgressByCategory = async function(userId, category) {
    return this.find({
      user_id: userId
    }).populate({
      path: 'achievement_id',
      match: { category: category }
    }).then(results => {
      // Lọc ra các kết quả có achievement_id không null
      return results.filter(result => result.achievement_id);
    });
  };

  /**
   * Cập nhật tiến trình thành tựu
   * @param {string} userId - ID của người dùng
   * @param {string} achievementId - ID của thành tựu
   * @param {number} progress - Tiến trình cần cập nhật
   * @param {boolean} increment - Tăng tiến trình (true) hoặc gán giá trị mới (false)
   * @param {Object} metadata - Metadata bổ sung
   * @returns {Promise<Object>} - Tiến trình sau khi cập nhật
   */
  schema.statics.updateProgress = async function(userId, achievementId, progress, increment = true, metadata = {}) {
    // Lấy thông tin thành tựu
    const Achievement = mongoose.model('Achievement');
    const achievement = await Achievement.findById(achievementId);
    
    if (!achievement) {
      throw new Error('Thành tựu không tồn tại');
    }
    
    // Tìm hoặc tạo tiến trình
    let achievementProgress = await this.findOne({
      user_id: userId,
      achievement_id: achievementId
    });
    
    if (!achievementProgress) {
      achievementProgress = new this({
        user_id: userId,
        achievement_id: achievementId,
        current_progress: 0,
        completed: false,
        rewarded: false,
        metadata: metadata
      });
    } else if (metadata && Object.keys(metadata).length > 0) {
      // Cập nhật metadata nếu có
      achievementProgress.metadata = {
        ...achievementProgress.metadata,
        ...metadata
      };
    }
    
    // Cập nhật tiến trình
    if (increment) {
      achievementProgress.current_progress += progress;
    } else {
      achievementProgress.current_progress = progress;
    }
    
    // Kiểm tra hoàn thành
    if (achievementProgress.current_progress >= achievement.requirement.count && !achievementProgress.completed) {
      achievementProgress.completed = true;
      achievementProgress.completed_at = new Date();
    }
    
    await achievementProgress.save();
    return achievementProgress;
  };

  /**
   * Kiểm tra và cập nhật tiến trình thành tựu theo loại yêu cầu
   * @param {string} userId - ID của người dùng
   * @param {string} requirementType - Loại yêu cầu
   * @param {number} progress - Tiến trình cần cập nhật
   * @param {Object} metadata - Metadata bổ sung
   * @returns {Promise<Array>} - Danh sách tiến trình đã cập nhật
   */
  schema.statics.updateProgressByRequirementType = async function(userId, requirementType, progress, metadata = {}) {
    // Lấy danh sách thành tựu theo loại yêu cầu
    const Achievement = mongoose.model('Achievement');
    const achievements = await Achievement.getByRequirementType(requirementType);
    
    // Cập nhật tiến trình cho từng thành tựu
    const updatedProgress = [];
    for (const achievement of achievements) {
      const achievementProgress = await this.updateProgress(userId, achievement._id, progress, true, metadata);
      updatedProgress.push(achievementProgress);
    }
    
    return updatedProgress;
  };
};

module.exports = setupStatics;
