const mongoose = require('mongoose');

/**
 * Định nghĩa các instance methods cho MissionProgress model
 * @param {Object} schema - Schema của MissionProgress model
 */
const setupMethods = (schema) => {
  /**
   * Cập nhật tiến trình của nhiệm vụ con
   * @param {number} subMissionIndex - Chỉ số của nhiệm vụ con
   * @param {number} progress - Tiến trình cần cập nhật
   * @param {boolean} increment - Tăng tiến trình (true) hoặc gán giá trị mới (false)
   * @returns {Promise<boolean>} - true nếu cập nhật thành công, false nếu không
   */
  schema.methods.updateSubProgress = async function(subMissionIndex, progress, increment = true) {
    // Lấy thông tin nhiệm vụ
    const Mission = mongoose.model('Mission');
    const mission = await Mission.findById(this.mission_id);
    
    if (!mission || !mission.subMissions || !mission.subMissions[subMissionIndex]) {
      return false;
    }
    
    // Tìm hoặc tạo tiến trình của nhiệm vụ con
    let subProgress = this.sub_progress.find(sp => sp.sub_mission_index === subMissionIndex);
    
    if (!subProgress) {
      subProgress = {
        sub_mission_index: subMissionIndex,
        current_progress: 0,
        completed: false
      };
      this.sub_progress.push(subProgress);
    } else {
      // Lấy chỉ số của subProgress trong mảng
      const index = this.sub_progress.findIndex(sp => sp.sub_mission_index === subMissionIndex);
      
      // Cập nhật tiến trình
      if (increment) {
        this.sub_progress[index].current_progress += progress;
      } else {
        this.sub_progress[index].current_progress = progress;
      }
      
      // Kiểm tra hoàn thành
      const requiredCount = mission.subMissions[subMissionIndex].requirement.count;
      if (this.sub_progress[index].current_progress >= requiredCount) {
        this.sub_progress[index].completed = true;
      }
    }
    
    // Kiểm tra xem tất cả nhiệm vụ con đã hoàn thành chưa
    const allSubMissionsCompleted = mission.subMissions.every((_, index) => {
      const subProgress = this.sub_progress.find(sp => sp.sub_mission_index === index);
      return subProgress && subProgress.completed;
    });
    
    // Nếu tất cả nhiệm vụ con đã hoàn thành, đánh dấu nhiệm vụ chính là hoàn thành
    if (allSubMissionsCompleted && !this.completed) {
      this.completed = true;
      this.completed_at = new Date();
    }
    
    await this.save();
    return true;
  };

  /**
   * Nhận thưởng cho nhiệm vụ đã hoàn thành
   * @returns {Promise<Object>} - Thông tin phần thưởng
   */
  schema.methods.claimReward = async function() {
    if (!this.completed) {
      throw new Error('Nhiệm vụ chưa hoàn thành');
    }
    
    if (this.rewarded) {
      throw new Error('Phần thưởng đã được nhận');
    }
    
    // Lấy thông tin nhiệm vụ
    const Mission = mongoose.model('Mission');
    const mission = await Mission.findById(this.mission_id);
    
    if (!mission) {
      throw new Error('Nhiệm vụ không tồn tại');
    }
    
    // Lấy thông tin người dùng
    const User = mongoose.model('User');
    const user = await User.findById(this.user_id);
    
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }
    
    // Cập nhật xu và kinh nghiệm cho người dùng
    const reward = {
      coins: mission.reward.coins,
      exp: mission.reward.exp
    };
    
    // Cập nhật xu
    if (reward.coins > 0) {
      user.coin += reward.coins;
      user.coin_total += reward.coins;
      
      // Tạo giao dịch
      const Transaction = mongoose.model('Transaction');
      await Transaction.createTransaction({
        user_id: user._id,
        description: `Hoàn thành nhiệm vụ: ${mission.title}`,
        type: 'reward',
        coin_change: reward.coins,
        reference_type: 'mission',
        reference_id: mission._id,
        metadata: {
          mission_type: mission.type,
          mission_title: mission.title
        }
      });
    }
    
    // Cập nhật kinh nghiệm
    if (reward.exp > 0) {
      // Cập nhật kinh nghiệm và cấp độ
      const UserLevel = mongoose.model('UserLevel');
      await UserLevel.addExperience(user._id, reward.exp, {
        source: 'mission',
        mission_id: mission._id,
        mission_title: mission.title
      });
    }
    
    // Đánh dấu là đã nhận thưởng
    this.rewarded = true;
    this.rewarded_at = new Date();
    
    await Promise.all([user.save(), this.save()]);
    
    return reward;
  };
};

module.exports = setupMethods;
