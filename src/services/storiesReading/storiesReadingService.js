const StoriesReading = require('../../models/storiesReading');
const Chapter = require('../../models/chapter');
const Story = require('../../models/story');

/**
 * Service xử lý logic nghiệp vụ cho lịch sử đọc truyện
 * Tối ưu hóa với schema mới và upsert pattern
 */
class StoriesReadingService {
  /**
   * Lấy tất cả lịch sử đọc truyện theo điều kiện với filtering nâng cao
   */
  async getAll(params) {
    const {
      user_id,
      story_id,
      status,
      search = '',
      page = 1,
      limit = 10,
      sort = { 'reading_stats.last_read_at': -1 }
    } = params;

    const query = {};
    if (user_id) query.user_id = user_id;
    if (story_id) query.story_id = story_id;
    if (status) query.reading_status = status;

    // Nếu có search term, sử dụng aggregation pipeline
    if (search) {
      return this.searchReadingHistory(user_id, search, {
        limit: parseInt(limit),
        skip: (page - 1) * parseInt(limit),
        status
      });
    }

    const total = await StoriesReading.countDocuments(query);
    const items = await StoriesReading.find(query)
      .sort(sort)
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('story_id', 'name slug image status authors categories')
      .populate('current_chapter.chapter_id', 'name chapter slug')
      .populate('last_completed_chapter.chapter_id', 'name chapter slug');

    return {
      items,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    };
  }

  /**
   * Lấy thông tin lịch sử đọc truyện theo ID
   */
  async getById(id) {
    const item = await StoriesReading.findById(id)
      .populate('story_id', 'name slug image status authors categories')
      .populate('current_chapter.chapter_id', 'name chapter slug')
      .populate('last_completed_chapter.chapter_id', 'name chapter slug')
      .populate('bookmarks.chapter_id', 'name chapter slug');

    if (!item) {
      throw new Error('Not found');
    }
    return item;
  }

  /**
   * Tạo mới lịch sử đọc truyện (ít sử dụng, ưu tiên upsert)
   */
  async create(data) {
    // Validate dữ liệu đầu vào
    await this.validateStoryAndChapter(data.story_id, data.current_chapter?.chapter_id);

    const item = new StoriesReading(data);
    return item.save();
  }

  /**
   * Cập nhật thông tin lịch sử đọc truyện
   */
  async update(id, data) {
    // Validate nếu có thay đổi story hoặc chapter
    if (data.story_id || data.current_chapter?.chapter_id) {
      await this.validateStoryAndChapter(
        data.story_id,
        data.current_chapter?.chapter_id
      );
    }

    const item = await StoriesReading.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true
    });

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
   * Lấy danh sách lịch sử đọc của người dùng với options nâng cao
   */
  async findByUser(userId, options = {}) {
    return StoriesReading.findByUser(userId, options);
  }

  /**
   * Cập nhật hoặc tạo mới lịch sử đọc (upsert pattern chính)
   */
  async upsertReading(userId, storyId, chapterData, options = {}) {
    // Validate story và chapter tồn tại
    await this.validateStoryAndChapter(storyId, chapterData.chapterId);

    // Lấy thông tin chapter để có chapter number
    const chapter = await Chapter.findById(chapterData.chapterId)
      .select('chapter name');

    if (!chapter) {
      throw new Error('Chapter not found');
    }

    if (chapter.chapter === undefined || chapter.chapter === null) {
      throw new Error(`Chapter ${chapterData.chapterId} does not have a valid chapter number: ${chapter.chapter}`);
    }

    const enrichedChapterData = {
      ...chapterData,
      chapterNumber: chapter.chapter
    };

    return StoriesReading.upsertReading(userId, storyId, enrichedChapterData, options);
  }

  /**
   * Cập nhật trạng thái đọc
   */
  async updateReadingStatus(userId, storyId, status) {
    return StoriesReading.updateReadingStatus(userId, storyId, status);
  }

  /**
   * Thêm bookmark
   */
  async addBookmark(userId, storyId, bookmarkData) {
    // Validate chapter tồn tại
    const chapter = await Chapter.findById(bookmarkData.chapterId)
      .select('chapter name');

    if (!chapter) {
      throw new Error('Chapter not found');
    }

    const enrichedBookmarkData = {
      ...bookmarkData,
      chapterNumber: chapter.chapter
    };

    return StoriesReading.addBookmark(userId, storyId, enrichedBookmarkData);
  }

  /**
   * Xóa bookmark
   */
  async removeBookmark(userId, storyId, bookmarkId) {
    return StoriesReading.removeBookmark(userId, storyId, bookmarkId);
  }

  /**
   * Cập nhật ghi chú cá nhân
   */
  async updatePersonalNotes(userId, storyId, notes) {
    return StoriesReading.updatePersonalNotes(userId, storyId, notes);
  }

  /**
   * Lấy thống kê đọc của user
   */
  async getUserReadingStats(userId) {
    return StoriesReading.getUserReadingStats(userId);
  }

  /**
   * Lấy danh sách truyện đang đọc gần đây
   */
  async getRecentlyRead(userId, limit = 5) {
    return StoriesReading.getRecentlyRead(userId, limit);
  }

  /**
   * Tìm kiếm trong lịch sử đọc
   */
  async searchReadingHistory(userId, searchTerm, options = {}) {
    return StoriesReading.searchReadingHistory(userId, searchTerm, options);
  }

  /**
   * Lấy tất cả bookmarks của user từ tất cả stories
   */
  async getAllUserBookmarks(userId, options = {}) {
    return StoriesReading.getAllUserBookmarks(userId, options);
  }

  /**
   * Xóa toàn bộ lịch sử đọc của user cho một story (bao gồm tất cả bookmarks)
   */
  async deleteUserStoryReading(userId, storyId) {
    return StoriesReading.deleteUserStoryReading(userId, storyId);
  }

  /**
   * Cleanup orphaned records
   */
  async cleanupOrphanedRecords() {
    return StoriesReading.cleanupOrphanedRecords();
  }

  /**
   * Validate story và chapter tồn tại
   */
  async validateStoryAndChapter(storyId, chapterId) {
    if (storyId) {
      const story = await Story.findById(storyId).select('_id status');
      if (!story) {
        throw new Error('Story not found');
      }
      if (story.status === 'deleted') {
        throw new Error('Story has been deleted');
      }
    }

    if (chapterId) {
      const chapter = await Chapter.findById(chapterId).select('_id status');
      if (!chapter) {
        throw new Error('Chapter not found');
      }
      if (chapter.status === 'deleted') {
        throw new Error('Chapter has been deleted');
      }
    }
  }

  /**
   * Lấy reading progress chi tiết cho một story
   */
  async getReadingProgress(userId, storyId) {
    const readingRecord = await this.findByUserAndStory(userId, storyId);
    if (!readingRecord) {
      return null;
    }

    // Lấy tổng số chapter của story
    const totalChapters = await Chapter.countDocuments({
      story_id: storyId,
      status: { $ne: 'deleted' }
    });

    const completedChapters = readingRecord.reading_stats.completed_chapters || 0;
    const currentChapter = readingRecord.current_chapter.chapter_number || 0;

    return {
      ...readingRecord.toObject(),
      total_chapters: totalChapters,
      progress_percentage: totalChapters > 0
        ? Math.round((completedChapters / totalChapters) * 100)
        : 0,
      is_up_to_date: currentChapter >= totalChapters
    };
  }

  /**
   * Batch update reading time cho multiple records
   */
  async batchUpdateReadingTime(updates) {
    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: {
          user_id: update.userId,
          story_id: update.storyId
        },
        update: {
          $inc: { 'reading_stats.total_reading_time': update.readingTime },
          $set: { 'reading_stats.last_read_at': new Date() }
        }
      }
    }));

    if (bulkOps.length > 0) {
      return StoriesReading.bulkWrite(bulkOps);
    }

    return { modifiedCount: 0 };
  }

  /**
   * Lấy reading streak của user
   */
  async getReadingStreak(userId) {
    const pipeline = [
      { $match: { user_id: userId } },
      { $sort: { 'reading_stats.last_read_at': -1 } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$reading_stats.last_read_at'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ];

    const dailyReading = await StoriesReading.aggregate(pipeline);

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const day of dailyReading) {
      const dayDate = new Date(day._id);
      const diffDays = Math.floor((currentDate - dayDate) / (1000 * 60 * 60 * 24));

      if (diffDays === streak) {
        streak++;
      } else {
        break;
      }
    }

    return {
      current_streak: streak,
      total_reading_days: dailyReading.length,
      last_read_date: dailyReading.length > 0 ? dailyReading[0]._id : null
    };
  }

  /**
   * Export reading data cho user (backup/migration)
   */
  async exportUserReadingData(userId) {
    const readingHistory = await StoriesReading.find({ user_id: userId })
      .populate('story_id', 'name slug image')
      .populate('current_chapter.chapter_id', 'name chapter')
      .populate('last_completed_chapter.chapter_id', 'name chapter')
      .sort({ 'reading_stats.last_read_at': -1 });

    const stats = await this.getUserReadingStats(userId);
    const streak = await this.getReadingStreak(userId);

    return {
      export_date: new Date(),
      user_id: userId,
      reading_history: readingHistory,
      statistics: stats,
      reading_streak: streak,
      total_records: readingHistory.length
    };
  }
}

module.exports = new StoriesReadingService();