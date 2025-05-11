/**
 * Định nghĩa các static methods cho StoriesReading model
 * @param {Object} schema - Schema của StoriesReading
 */
module.exports = function(schema) {
  /**
   * Tìm lịch sử đọc theo user_id và story_id
   */
  schema.statics.findByUserAndStory = function(userId, storyId) {
    return this.findOne({
      user_id: userId,
      story_id: storyId
    });
  };

  /**
   * Lấy danh sách lịch sử đọc của người dùng
   */
  schema.statics.findByUser = function(userId, limit = 10, skip = 0) {
    return this.find({
      user_id: userId
    })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('story', 'name slug image')
      .populate('chapter_reading', 'name chapter');
  };

  /**
   * Cập nhật hoặc tạo mới lịch sử đọc
   */
  schema.statics.upsertReading = async function(userId, storyId, chapterId, position = 0) {
    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      {
        chapter_id_reading: chapterId,
        reading_position: position,
        $inc: { read_count: 1 },
        $setOnInsert: { user_id: userId, story_id: storyId }
      },
      {
        new: true,
        upsert: true
      }
    );
  };

  /**
   * Cập nhật chapter đã đọc
   */
  schema.statics.updateChapterRead = async function(userId, storyId, chapterId) {
    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      {
        chapter_id_read: chapterId
      },
      {
        new: true
      }
    );
  };
}; 