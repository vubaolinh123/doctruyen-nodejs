const StoriesReading = require('../../models/storiesReading');

/**
 * Service xử lý logic nghiệp vụ cho lịch sử đọc truyện
 */
class StoriesReadingService {
  /**
   * Lấy tất cả lịch sử đọc truyện theo điều kiện
   */
  async getAll(params) {
    const { customer_id, story_id, search = '', page = 1, limit = 10, sort = '-createdAt' } = params;
    const query = {};
    if (customer_id) query.user_id = customer_id;
    if (story_id) query.story_id = story_id;

    return StoriesReading.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
  }

  /**
   * Lấy thông tin lịch sử đọc truyện theo ID
   */
  async getById(id) {
    const item = await StoriesReading.findById(id);
    if (!item) {
      throw new Error('Not found');
    }
    return item;
  }

  /**
   * Tạo mới lịch sử đọc truyện
   */
  async create(data) {
    const item = new StoriesReading(data);
    return item.save();
  }

  /**
   * Cập nhật thông tin lịch sử đọc truyện
   */
  async update(id, data) {
    const item = await StoriesReading.findByIdAndUpdate(id, data, { new: true });
    if (!item) {
      throw new Error('Not found');
    }
    return item;
  }

  /**
   * Xóa lịch sử đọc truyện
   */
  async remove(id) {
    const item = await StoriesReading.findByIdAndDelete(id);
    if (!item) {
      throw new Error('Not found');
    }
    return { message: 'Deleted successfully' };
  }

  /**
   * Tìm lịch sử đọc theo user_id và story_id
   */
  async findByUserAndStory(userId, storyId) {
    return StoriesReading.findByUserAndStory(userId, storyId);
  }

  /**
   * Lấy danh sách lịch sử đọc của người dùng
   */
  async findByUser(userId, limit = 10, skip = 0) {
    return StoriesReading.findByUser(userId, limit, skip);
  }

  /**
   * Cập nhật hoặc tạo mới lịch sử đọc
   */
  async upsertReading(userId, storyId, chapterId, position = 0) {
    return StoriesReading.upsertReading(userId, storyId, chapterId, position);
  }

  /**
   * Cập nhật chapter đã đọc
   */
  async updateChapterRead(userId, storyId, chapterId) {
    return StoriesReading.updateChapterRead(userId, storyId, chapterId);
  }
}

module.exports = new StoriesReadingService(); 