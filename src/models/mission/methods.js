/**
 * Định nghĩa các instance methods cho Mission model
 * @param {Object} schema - Schema của Mission model
 */
const setupMethods = (schema) => {
  /**
   * Kiểm tra xem nhiệm vụ có phải là nhiệm vụ hàng ngày không
   * @returns {boolean} - true nếu là nhiệm vụ hàng ngày, false nếu không phải
   */
  schema.methods.isDaily = function() {
    return this.type === 'daily';
  };

  /**
   * Kiểm tra xem nhiệm vụ có phải là nhiệm vụ hàng tuần không
   * @returns {boolean} - true nếu là nhiệm vụ hàng tuần, false nếu không phải
   */
  schema.methods.isWeekly = function() {
    return this.type === 'weekly';
  };

  /**
   * Lấy tổng phần thưởng xu của nhiệm vụ
   * @returns {number} - Tổng số xu thưởng
   */
  schema.methods.getTotalCoins = function() {
    return this.reward.coins;
  };

  /**
   * Lấy tổng phần thưởng kinh nghiệm của nhiệm vụ
   * @returns {number} - Tổng số điểm kinh nghiệm thưởng
   */
  schema.methods.getTotalExp = function() {
    return this.reward.exp;
  };

  /**
   * Lấy thông tin nhiệm vụ dưới dạng đối tượng đơn giản
   * @returns {Object} - Thông tin nhiệm vụ
   */
  schema.methods.toSimpleObject = function() {
    return {
      id: this._id,
      title: this.title,
      description: this.description,
      type: this.type,
      rarity: this.rarity,
      requirement: {
        type: this.requirement.type,
        count: this.requirement.count
      },
      reward: {
        coins: this.reward.coins,
        exp: this.reward.exp
      },
      subMissions: this.subMissions.map(sub => ({
        title: sub.title,
        description: sub.description,
        requirement: {
          type: sub.requirement.type,
          count: sub.requirement.count
        }
      }))
    };
  };
};

module.exports = setupMethods;
