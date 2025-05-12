/**
 * Định nghĩa các static methods cho Comment model
 * @param {Object} schema - Schema của Comment model
 */
const setupStatics = (schema) => {
  /**
   * Lấy danh sách bình luận của truyện
   * @param {string} storyId - ID của truyện
   * @param {number} limit - Số lượng bình luận cần lấy
   * @param {number} skip - Số lượng bình luận cần bỏ qua
   * @returns {Promise<Array>} - Danh sách bình luận
   */
  schema.statics.findByStory = function(storyId, limit = 10, skip = 0) {
    return this.find({
      story_id: storyId,
      parent_id: { $exists: false },
      status: 'active',
      'metadata.type': 'story'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name avatar');
  };

  /**
   * Lấy danh sách bình luận của chương
   * @param {string} storyId - ID của truyện
   * @param {string} chapterId - ID của chương
   * @param {number} limit - Số lượng bình luận cần lấy
   * @param {number} skip - Số lượng bình luận cần bỏ qua
   * @returns {Promise<Array>} - Danh sách bình luận
   */
  schema.statics.findByChapter = function(storyId, chapterId, limit = 10, skip = 0) {
    return this.find({
      story_id: storyId,
      chapter_id: chapterId,
      parent_id: { $exists: false },
      status: 'active',
      'metadata.type': 'chapter'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name avatar');
  };

  /**
   * Lấy danh sách bình luận con
   * @param {string} parentId - ID của bình luận cha
   * @param {number} limit - Số lượng bình luận cần lấy
   * @param {number} skip - Số lượng bình luận cần bỏ qua
   * @returns {Promise<Array>} - Danh sách bình luận con
   */
  schema.statics.findReplies = function(parentId, limit = 10, skip = 0) {
    return this.find({
      parent_id: parentId,
      status: 'active'
    })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name avatar');
  };

  /**
   * Lấy danh sách bình luận của người dùng
   * @param {string} userId - ID của người dùng
   * @param {number} limit - Số lượng bình luận cần lấy
   * @param {number} skip - Số lượng bình luận cần bỏ qua
   * @returns {Promise<Array>} - Danh sách bình luận
   */
  schema.statics.findByUser = function(userId, limit = 10, skip = 0) {
    return this.find({
      user_id: userId,
      status: 'active'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('story', 'name slug')
      .populate('chapter', 'name chapter');
  };

  /**
   * Đếm số lượng bình luận của truyện
   * @param {string} storyId - ID của truyện
   * @returns {Promise<number>} - Số lượng bình luận
   */
  schema.statics.countByStory = function(storyId) {
    return this.countDocuments({
      story_id: storyId,
      status: 'active',
      'metadata.type': 'story'
    });
  };

  /**
   * Đếm số lượng bình luận của chương
   * @param {string} storyId - ID của truyện
   * @param {string} chapterId - ID của chương
   * @returns {Promise<number>} - Số lượng bình luận
   */
  schema.statics.countByChapter = function(storyId, chapterId) {
    return this.countDocuments({
      story_id: storyId,
      chapter_id: chapterId,
      status: 'active',
      'metadata.type': 'chapter'
    });
  };
};

module.exports = setupStatics;
