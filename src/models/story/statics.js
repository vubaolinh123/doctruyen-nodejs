/**
 * Định nghĩa các static methods cho Story model
 * @param {Object} schema - Schema của Story model
 */
const setupStatics = (schema) => {
  /**
   * Tìm truyện theo slug
   * @param {string} slug - Slug của truyện
   * @returns {Promise<Object>} - Thông tin truyện
   */
  schema.statics.findBySlug = function(slug) {
    return this.findOne({
      slug: slug,
      status: true
    });
  };

  /**
   * Tìm truyện nổi bật
   * @param {number} limit - Số lượng truyện cần lấy
   * @returns {Promise<Array>} - Danh sách truyện nổi bật
   */
  schema.statics.findHotStories = function(limit = 10) {
    return this.find({
      is_hot: true,
      status: true
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  };

  /**
   * Tìm truyện được đánh giá cao
   * @param {number} limit - Số lượng truyện cần lấy
   * @returns {Promise<Array>} - Danh sách truyện được đánh giá cao
   * @deprecated - Sử dụng StoryRankings.findAllTimeRankings thay thế
   */
  schema.statics.findTopRatedStories = function(limit = 10) {
    return this.find({
      status: true
    })
      .sort({ views: -1 })
      .limit(limit);
  };

  /**
   * Tìm truyện mới cập nhật
   * @param {number} limit - Số lượng truyện cần lấy
   * @returns {Promise<Array>} - Danh sách truyện mới cập nhật
   */
  schema.statics.findRecentlyUpdated = function(limit = 10) {
    return this.find({ status: true })
      .sort({ updatedAt: -1 })
      .limit(limit);
  };

  /**
   * Tìm truyện theo thể loại
   * @param {string} categoryId - ID của thể loại
   * @param {number} limit - Số lượng truyện cần lấy
   * @returns {Promise<Array>} - Danh sách truyện thuộc thể loại
   */
  schema.statics.findByCategory = function(categoryId, limit = 10) {
    return this.find({
      categories: categoryId,
      status: true
    })
      .sort({ updatedAt: -1 })
      .limit(limit);
  };

  /**
   * Tìm truyện theo tác giả
   * @param {string} authorId - ID của tác giả
   * @param {number} limit - Số lượng truyện cần lấy
   * @returns {Promise<Array>} - Danh sách truyện của tác giả
   */
  schema.statics.findByAuthor = function(authorId, limit = 10) {
    return this.find({
      author_id: authorId,
      status: true
    })
      .sort({ updatedAt: -1 })
      .limit(limit);
  };

  /**
   * Tìm truyện theo từ khóa
   * @param {string} keyword - Từ khóa tìm kiếm
   * @param {number} limit - Số lượng truyện cần lấy
   * @returns {Promise<Array>} - Danh sách truyện tìm thấy
   */
  schema.statics.search = function(keyword, limit = 10) {
    return this.find({
      $text: { $search: keyword },
      status: true
    })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit);
  };

  /**
   * Tìm truyện đề xuất dựa trên thể loại và lượt xem
   * @param {Array} categoryIds - Danh sách ID thể loại
   * @param {string} excludeStoryId - ID truyện cần loại trừ
   * @param {number} page - Trang hiện tại
   * @param {number} limit - Số lượng truyện mỗi trang
   * @returns {Promise<Array>} - Danh sách truyện đề xuất
   */
  schema.statics.findSuggestedStories = function(categoryIds, excludeStoryId, page = 1, limit = 6) {
    // Tạo query để tìm truyện có cùng thể loại, trừ truyện hiện tại
    const query = {
      categories: { $in: categoryIds },
      status: true
    };

    // Loại trừ truyện hiện tại nếu có
    if (excludeStoryId) {
      query._id = { $ne: excludeStoryId };
    }

    return this.find(query)
      .sort({ views: -1 }) // Sắp xếp theo lượt xem giảm dần
      .skip((page - 1) * limit)
      .limit(limit);
  };

  /**
   * Đếm tổng số truyện đề xuất
   * @param {Array} categoryIds - Danh sách ID thể loại
   * @param {string} excludeStoryId - ID truyện cần loại trừ
   * @returns {Promise<number>} - Tổng số truyện đề xuất
   */
  schema.statics.countSuggestedStories = function(categoryIds, excludeStoryId) {
    // Tạo query để tìm truyện có cùng thể loại, trừ truyện hiện tại
    const query = {
      categories: { $in: categoryIds },
      status: true
    };

    // Loại trừ truyện hiện tại nếu có
    if (excludeStoryId) {
      query._id = { $ne: excludeStoryId };
    }

    return this.countDocuments(query);
  };
};

module.exports = setupStatics;
