/**
 * Định nghĩa các static methods cho Chapter model
 * @param {Object} schema - Schema của Chapter model
 */
const setupStatics = (schema) => {
  /**
   * Tìm chapter theo story_id và chapter number
   * @param {string} storyId - ID của truyện
   * @param {number} chapterNumber - Số chapter
   * @returns {Promise<Object>} - Chapter tìm thấy
   */
  schema.statics.findByStoryAndNumber = function(storyId, chapterNumber) {
    return this.findOne({
      story_id: storyId,
      chapter: chapterNumber,
      status: true
    });
  };

  /**
   * Tìm chapter theo story_id và slug
   * @param {string} storyId - ID của truyện
   * @param {string} slug - Slug của chapter
   * @returns {Promise<Object>} - Chapter tìm thấy
   */
  schema.statics.findByStoryAndSlug = function(storyId, slug) {
    return this.findOne({
      story_id: storyId,
      slug: slug,
      status: true
    });
  };

  /**
   * Lấy danh sách chapter của truyện
   * @param {string} storyId - ID của truyện
   * @param {number} limit - Số lượng chapter cần lấy
   * @param {number} skip - Số lượng chapter cần bỏ qua
   * @returns {Promise<Array>} - Danh sách chapter
   */
  schema.statics.findByStory = function(storyId, limit = 0, skip = 0) {
    const query = this.find({
      story_id: storyId,
      status: true
    }).sort({ chapter: 1 });

    if (limit > 0) {
      query.limit(limit);
    }

    if (skip > 0) {
      query.skip(skip);
    }

    return query;
  };

  /**
   * Lấy chapter mới nhất của truyện
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Object>} - Chapter mới nhất
   */
  schema.statics.findLatestByStory = function(storyId) {
    return this.findOne({
      story_id: storyId,
      status: true
    }).sort({ chapter: -1 });
  };

  /**
   * Lấy chapter đầu tiên của truyện
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Object>} - Chapter đầu tiên
   */
  schema.statics.findFirstByStory = function(storyId) {
    return this.findOne({
      story_id: storyId,
      status: true
    }).sort({ chapter: 1 });
  };

  /**
   * Lấy chapter tiếp theo
   * @param {string} storyId - ID của truyện
   * @param {number} currentChapter - Số chapter hiện tại
   * @returns {Promise<Object>} - Chapter tiếp theo
   */
  schema.statics.findNextChapter = function(storyId, currentChapter) {
    return this.findOne({
      story_id: storyId,
      chapter: { $gt: currentChapter },
      status: true
    }).sort({ chapter: 1 });
  };

  /**
   * Lấy chapter trước đó
   * @param {string} storyId - ID của truyện
   * @param {number} currentChapter - Số chapter hiện tại
   * @returns {Promise<Object>} - Chapter trước đó
   */
  schema.statics.findPreviousChapter = function(storyId, currentChapter) {
    return this.findOne({
      story_id: storyId,
      chapter: { $lt: currentChapter },
      status: true
    }).sort({ chapter: -1 });
  };
};

module.exports = setupStatics;
