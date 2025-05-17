/**
 * Định nghĩa các static methods cho Mission model
 * @param {Object} schema - Schema của Mission model
 */
const setupStatics = (schema) => {
  /**
   * Lấy danh sách nhiệm vụ hàng ngày
   * @param {boolean} status - Trạng thái hiển thị
   * @returns {Promise<Array>} - Danh sách nhiệm vụ hàng ngày
   */
  schema.statics.getDailyMissions = function(status = true) {
    return this.find({
      type: 'daily',
      status: status
    }).sort({ order: 1, rarity: 1 });
  };

  /**
   * Lấy danh sách nhiệm vụ hàng tuần
   * @param {boolean} status - Trạng thái hiển thị
   * @returns {Promise<Array>} - Danh sách nhiệm vụ hàng tuần
   */
  schema.statics.getWeeklyMissions = function(status = true) {
    return this.find({
      type: 'weekly',
      status: status
    }).sort({ order: 1, rarity: 1 });
  };

  /**
   * Lấy danh sách nhiệm vụ theo loại yêu cầu
   * @param {string} requirementType - Loại yêu cầu
   * @param {boolean} status - Trạng thái hiển thị
   * @returns {Promise<Array>} - Danh sách nhiệm vụ
   */
  schema.statics.getByRequirementType = function(requirementType, status = true) {
    return this.find({
      'requirement.type': requirementType,
      status: status
    }).sort({ type: 1, order: 1 });
  };

  /**
   * Lấy danh sách nhiệm vụ theo độ hiếm
   * @param {string} rarity - Độ hiếm
   * @param {boolean} status - Trạng thái hiển thị
   * @returns {Promise<Array>} - Danh sách nhiệm vụ
   */
  schema.statics.getByRarity = function(rarity, status = true) {
    return this.find({
      rarity: rarity,
      status: status
    }).sort({ type: 1, order: 1 });
  };
};

module.exports = setupStatics;
