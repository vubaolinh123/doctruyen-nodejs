/**
 * Định nghĩa các static methods cho UserRating model
 * @param {Object} schema - Schema của UserRating model
 */
const setupStatics = (schema) => {
  /**
   * Tìm đánh giá của người dùng cho truyện
   * @param {string} userId - ID của người dùng
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Object>} - Thông tin đánh giá
   */
  schema.statics.findByUserAndStory = function(userId, storyId) {
    return this.findOne({
      user_id: userId,
      story_id: storyId
    });
  };

  /**
   * Lấy danh sách đánh giá của người dùng
   * @param {string} userId - ID của người dùng
   * @param {number} limit - Số lượng đánh giá cần lấy
   * @param {number} skip - Số lượng đánh giá cần bỏ qua
   * @returns {Promise<Array>} - Danh sách đánh giá
   */
  schema.statics.findByUser = function(userId, limit = 10, skip = 0) {
    return this.find({
      user_id: userId
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('story_id', 'name slug image');
  };

  /**
   * Lấy danh sách đánh giá của truyện
   * @param {string} storyId - ID của truyện
   * @param {number} limit - Số lượng đánh giá cần lấy
   * @param {number} skip - Số lượng đánh giá cần bỏ qua
   * @returns {Promise<Array>} - Danh sách đánh giá
   */
  schema.statics.findByStory = function(storyId, limit = 10, skip = 0) {
    return this.find({
      story_id: storyId
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user_id', 'name slug avatar');
  };
};

module.exports = setupStatics;
