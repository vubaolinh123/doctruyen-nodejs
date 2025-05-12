/**
 * Định nghĩa các static methods cho Bookmark model
 * @param {Object} schema - Schema của Bookmark model
 */
const setupStatics = (schema) => {
  /**
   * Tìm bookmark theo user_id và story_id
   * @param {string} userId - ID của người dùng
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Object>} - Bookmark tìm thấy
   */
  schema.statics.findByCustomerAndStory = function(userId, storyId) {
    return this.findOne({
      user_id: userId,
      story_id: storyId
    });
  };

  /**
   * Lấy danh sách bookmark của người dùng
   * @param {string} userId - ID của người dùng
   * @param {number} limit - Số lượng bookmark cần lấy
   * @param {number} skip - Số lượng bookmark cần bỏ qua
   * @returns {Promise<Array>} - Danh sách bookmark
   */
  schema.statics.findByCustomer = function(userId, limit = 10, skip = 0) {
    return this.find({
      user_id: userId
    })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('story', 'name slug image')
      .populate('chapter', 'name chapter');
  };

  /**
   * Cập nhật hoặc tạo mới bookmark
   * @param {string} userId - ID của người dùng
   * @param {string} storyId - ID của truyện
   * @param {string} chapterId - ID của chapter
   * @param {string} note - Ghi chú của người dùng
   * @returns {Promise<Object>} - Bookmark đã cập nhật hoặc tạo mới
   */
  schema.statics.upsertBookmark = async function(userId, storyId, chapterId, note = '') {
    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      {
        chapter_id: chapterId,
        note: note,
        $setOnInsert: { user_id: userId, story_id: storyId }
      },
      {
        new: true,
        upsert: true
      }
    );
  };

  /**
   * Xóa tất cả bookmark của người dùng
   * @param {string} userId - ID của người dùng
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.statics.removeAllByCustomer = async function(userId) {
    return this.deleteMany({ user_id: userId });
  };
};

module.exports = setupStatics;
