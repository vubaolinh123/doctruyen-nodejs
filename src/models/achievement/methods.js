/**
 * Định nghĩa các instance methods cho Achievement model
 * @param {Object} schema - Schema của Achievement model
 */
const setupMethods = (schema) => {
  /**
   * Kiểm tra xem thành tựu có bị ẩn không
   * @returns {boolean} - true nếu thành tựu bị ẩn, false nếu không
   */
  schema.methods.isHidden = function() {
    return this.hidden;
  };

  /**
   * Kiểm tra xem thành tựu có bị khóa không
   * @returns {boolean} - true nếu thành tựu bị khóa, false nếu không
   */
  schema.methods.isLocked = function() {
    return this.locked;
  };

  /**
   * Lấy tổng phần thưởng xu của thành tựu
   * @returns {number} - Tổng số xu thưởng
   */
  schema.methods.getTotalCoins = function() {
    return this.reward.coins;
  };

  /**
   * Lấy tổng phần thưởng kinh nghiệm của thành tựu
   * @returns {number} - Tổng số điểm kinh nghiệm thưởng
   */
  schema.methods.getTotalExp = function() {
    return this.reward.exp;
  };

  /**
   * Lấy thông tin thành tựu dưới dạng đối tượng đơn giản
   * @returns {Object} - Thông tin thành tựu
   */
  schema.methods.toSimpleObject = function() {
    return {
      id: this._id,
      title: this.title,
      description: this.description,
      icon: this.icon,
      category: this.category,
      rarity: this.rarity,
      requirement: {
        type: this.requirement.type,
        count: this.requirement.count
      },
      reward: {
        type: this.reward.type,
        value: this.reward.value,
        coins: this.reward.coins,
        exp: this.reward.exp
      },
      hidden: this.hidden,
      locked: this.locked
    };
  };
};

module.exports = setupMethods;
