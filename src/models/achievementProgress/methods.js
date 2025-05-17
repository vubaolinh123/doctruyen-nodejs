const mongoose = require('mongoose');

/**
 * Định nghĩa các instance methods cho AchievementProgress model
 * @param {Object} schema - Schema của AchievementProgress model
 */
const setupMethods = (schema) => {
  /**
   * Nhận thưởng cho thành tựu đã hoàn thành
   * @returns {Promise<Object>} - Thông tin phần thưởng
   */
  schema.methods.claimReward = async function() {
    if (!this.completed) {
      throw new Error('Thành tựu chưa hoàn thành');
    }
    
    if (this.rewarded) {
      throw new Error('Phần thưởng đã được nhận');
    }
    
    // Lấy thông tin thành tựu
    const Achievement = mongoose.model('Achievement');
    const achievement = await Achievement.findById(this.achievement_id);
    
    if (!achievement) {
      throw new Error('Thành tựu không tồn tại');
    }
    
    // Lấy thông tin người dùng
    const User = mongoose.model('User');
    const user = await User.findById(this.user_id);
    
    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }
    
    // Cập nhật xu và kinh nghiệm cho người dùng
    const reward = {
      type: achievement.reward.type,
      value: achievement.reward.value,
      coins: achievement.reward.coins,
      exp: achievement.reward.exp
    };
    
    // Cập nhật xu
    if (reward.coins > 0) {
      user.coin += reward.coins;
      user.coin_total += reward.coins;
      
      // Tạo giao dịch
      const Transaction = mongoose.model('Transaction');
      await Transaction.createTransaction({
        user_id: user._id,
        description: `Đạt được thành tựu: ${achievement.title}`,
        type: 'reward',
        coin_change: reward.coins,
        reference_type: 'achievement',
        reference_id: achievement._id,
        metadata: {
          achievement_title: achievement.title,
          achievement_category: achievement.category,
          achievement_rarity: achievement.rarity
        }
      });
    }
    
    // Cập nhật kinh nghiệm
    if (reward.exp > 0) {
      // Cập nhật kinh nghiệm và cấp độ
      const UserLevel = mongoose.model('UserLevel');
      await UserLevel.addExperience(user._id, reward.exp, {
        source: 'achievement',
        achievement_id: achievement._id,
        achievement_title: achievement.title
      });
    }
    
    // Xử lý các phần thưởng đặc biệt
    if (reward.type !== 'xu') {
      // Lưu thông tin phần thưởng đặc biệt vào metadata
      this.metadata = {
        ...this.metadata,
        special_reward: {
          type: reward.type,
          value: reward.value,
          claimed_at: new Date()
        }
      };
      
      // TODO: Xử lý các loại phần thưởng đặc biệt khác (frame, nameColor, chatColor, badge, v.v.)
    }
    
    // Đánh dấu là đã nhận thưởng
    this.rewarded = true;
    this.rewarded_at = new Date();
    
    await Promise.all([user.save(), this.save()]);
    
    return reward;
  };

  /**
   * Lấy phần trăm hoàn thành
   * @returns {number} - Phần trăm hoàn thành (0-100)
   */
  schema.methods.getCompletionPercentage = async function() {
    // Lấy thông tin thành tựu
    const Achievement = mongoose.model('Achievement');
    const achievement = await Achievement.findById(this.achievement_id);
    
    if (!achievement) {
      return 0;
    }
    
    const total = achievement.requirement.count;
    if (total <= 0) {
      return this.completed ? 100 : 0;
    }
    
    const percentage = Math.min(100, Math.floor((this.current_progress / total) * 100));
    return percentage;
  };
};

module.exports = setupMethods;
