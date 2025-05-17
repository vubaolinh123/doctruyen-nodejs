/**
 * Định nghĩa các static methods cho Achievement model
 * @param {Object} schema - Schema của Achievement model
 */
const setupStatics = (schema) => {
  /**
   * Lấy danh sách tất cả thành tựu
   * @param {boolean} status - Trạng thái hiển thị
   * @returns {Promise<Array>} - Danh sách thành tựu
   */
  schema.statics.getAllAchievements = function(status = true) {
    return this.find({
      status: status
    }).sort({ category: 1, rarity: 1, order: 1 });
  };

  /**
   * Lấy danh sách thành tựu theo loại
   * @param {string} category - Loại thành tựu
   * @param {boolean} status - Trạng thái hiển thị
   * @returns {Promise<Array>} - Danh sách thành tựu
   */
  schema.statics.getByCategory = function(category, status = true) {
    return this.find({
      category: category,
      status: status
    }).sort({ rarity: 1, order: 1 });
  };

  /**
   * Lấy danh sách thành tựu theo độ hiếm
   * @param {string} rarity - Độ hiếm
   * @param {boolean} status - Trạng thái hiển thị
   * @returns {Promise<Array>} - Danh sách thành tựu
   */
  schema.statics.getByRarity = function(rarity, status = true) {
    return this.find({
      rarity: rarity,
      status: status
    }).sort({ category: 1, order: 1 });
  };

  /**
   * Lấy danh sách thành tựu theo loại yêu cầu
   * @param {string} requirementType - Loại yêu cầu
   * @param {boolean} status - Trạng thái hiển thị
   * @returns {Promise<Array>} - Danh sách thành tựu
   */
  schema.statics.getByRequirementType = function(requirementType, status = true) {
    return this.find({
      'requirement.type': requirementType,
      status: status
    }).sort({ category: 1, rarity: 1, order: 1 });
  };

  /**
   * Lấy danh sách thành tựu không bị ẩn
   * @param {boolean} status - Trạng thái hiển thị
   * @returns {Promise<Array>} - Danh sách thành tựu
   */
  schema.statics.getVisibleAchievements = function(status = true) {
    return this.find({
      hidden: false,
      status: status
    }).sort({ category: 1, rarity: 1, order: 1 });
  };

  /**
   * Lấy danh sách thành tựu bị ẩn
   * @param {boolean} status - Trạng thái hiển thị
   * @returns {Promise<Array>} - Danh sách thành tựu
   */
  schema.statics.getHiddenAchievements = function(status = true) {
    return this.find({
      hidden: true,
      status: status
    }).sort({ category: 1, rarity: 1, order: 1 });
  };
};

module.exports = setupStatics;
