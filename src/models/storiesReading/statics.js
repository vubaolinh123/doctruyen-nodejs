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
    })
    .populate('story_id', 'name slug image status')
    .populate('current_chapter.chapter_id', 'name chapter_number slug')
    .populate('last_completed_chapter.chapter_id', 'name chapter_number slug');
  };

  /**
   * Lấy danh sách lịch sử đọc của người dùng với filtering
   */
  schema.statics.findByUser = function(userId, options = {}) {
    const {
      status,
      limit = 10,
      skip = 0,
      sort = { 'reading_stats.last_read_at': -1 },
      includeCompleted = true
    } = options;

    const query = { user_id: userId };

    // Filter theo reading status
    if (status) {
      query.reading_status = status;
    } else if (!includeCompleted) {
      query.reading_status = { $ne: 'completed' };
    }

    return this.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('story_id', 'name slug image status authors categories')
      .populate('current_chapter.chapter_id', 'name chapter_number slug')
      .populate('last_completed_chapter.chapter_id', 'name chapter_number slug');
  };

  /**
   * Cập nhật hoặc tạo mới lịch sử đọc (upsert pattern)
   * Đã tối ưu hóa để loại bỏ reading_position và sử dụng readingTime tính bằng giây
   */
  schema.statics.upsertReading = async function(userId, storyId, chapterData, options = {}) {
    const {
      chapterId,
      chapterNumber,
      readingTime = 0, // Thời gian đọc tính bằng giây
      markCompleted = false,
      status = 'reading' // Trạng thái: 'reading' hoặc 'completed'
    } = chapterData;

    // Prepare update operations - đã loại bỏ reading_position
    const updateOps = {
      $set: {
        'current_chapter.chapter_id': chapterId,
        'current_chapter.chapter_number': chapterNumber,
        'reading_stats.last_read_at': new Date()
      },
      $inc: {
        'reading_stats.visit_count': 1,
        'reading_stats.total_reading_time': readingTime // Tính bằng giây
      },
      $setOnInsert: {
        user_id: userId,
        story_id: storyId,
        reading_status: status,
        'reading_stats.first_read_at': new Date()
      }
    };

    // Nếu đánh dấu chapter đã hoàn thành hoặc status là 'completed'
    if (markCompleted || status === 'completed') {
      updateOps.$set['last_completed_chapter.chapter_id'] = chapterId;
      updateOps.$set['last_completed_chapter.chapter_number'] = chapterNumber;
      updateOps.$set['last_completed_chapter.completed_at'] = new Date();
      updateOps.$inc['reading_stats.completed_chapters'] = 1;
      updateOps.$set['reading_status'] = 'completed';
    } else if (status === 'reading') {
      updateOps.$set['reading_status'] = 'reading';
    }

    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      updateOps,
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );
  };

  /**
   * Cập nhật trạng thái đọc
   */
  schema.statics.updateReadingStatus = async function(userId, storyId, status) {
    const validStatuses = ['reading', 'completed', 'paused', 'dropped', 'plan_to_read'];

    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid reading status: ${status}`);
    }

    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      {
        reading_status: status,
        'reading_stats.last_read_at': new Date()
      },
      { new: true }
    );
  };

  /**
   * Thêm bookmark
   */
  schema.statics.addBookmark = async function(userId, storyId, bookmarkData) {
    const { chapterId, chapterNumber, position = 0, note = '' } = bookmarkData;

    const bookmark = {
      chapter_id: chapterId,
      chapter_number: chapterNumber,
      position,
      note: note.substring(0, 200), // Giới hạn độ dài note
      created_at: new Date()
    };

    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      {
        $push: {
          bookmarks: {
            $each: [bookmark],
            $sort: { created_at: -1 },
            $slice: 10 // Giữ tối đa 10 bookmarks
          }
        }
      },
      { new: true }
    );
  };

  /**
   * Xóa bookmark
   */
  schema.statics.removeBookmark = async function(userId, storyId, bookmarkId) {
    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      { $pull: { bookmarks: { _id: bookmarkId } } },
      { new: true }
    );
  };

  /**
   * Cập nhật ghi chú cá nhân
   */
  schema.statics.updatePersonalNotes = async function(userId, storyId, notes) {
    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      {
        personal_notes: notes.substring(0, 1000), // Giới hạn độ dài
        'reading_stats.last_read_at': new Date()
      },
      { new: true }
    );
  };

  /**
   * Lấy thống kê đọc của user
   */
  schema.statics.getUserReadingStats = async function(userId) {
    const pipeline = [
      { $match: { user_id: userId } },
      {
        $group: {
          _id: '$reading_status',
          count: { $sum: 1 },
          total_reading_time: { $sum: '$reading_stats.total_reading_time' },
          total_chapters: { $sum: '$reading_stats.completed_chapters' }
        }
      }
    ];

    const stats = await this.aggregate(pipeline);

    // Format kết quả
    const result = {
      reading: 0,
      completed: 0,
      paused: 0,
      dropped: 0,
      plan_to_read: 0,
      total_stories: 0,
      total_reading_time: 0,
      total_chapters_read: 0
    };

    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total_stories += stat.count;
      result.total_reading_time += stat.total_reading_time;
      result.total_chapters_read += stat.total_chapters;
    });

    return result;
  };

  /**
   * Lấy danh sách truyện đang đọc gần đây
   */
  schema.statics.getRecentlyRead = async function(userId, limit = 5) {
    return this.find({
      user_id: userId,
      reading_status: { $in: ['reading', 'paused'] }
    })
    .sort({ 'reading_stats.last_read_at': -1 })
    .limit(limit)
    .populate('story_id', 'name slug image')
    .populate('current_chapter.chapter_id', 'name chapter_number');
  };

  /**
   * Tìm kiếm trong lịch sử đọc
   */
  schema.statics.searchReadingHistory = async function(userId, searchTerm, options = {}) {
    const { limit = 10, skip = 0, status } = options;

    const pipeline = [
      { $match: { user_id: userId } },
      {
        $lookup: {
          from: 'stories',
          localField: 'story_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      { $unwind: '$story' },
      {
        $match: {
          $or: [
            { 'story.name': { $regex: searchTerm, $options: 'i' } },
            { 'personal_notes': { $regex: searchTerm, $options: 'i' } },
            { 'metadata.personal_tags': { $regex: searchTerm, $options: 'i' } }
          ]
        }
      }
    ];

    if (status) {
      pipeline.push({ $match: { reading_status: status } });
    }

    pipeline.push(
      { $sort: { 'reading_stats.last_read_at': -1 } },
      { $skip: skip },
      { $limit: limit }
    );

    return this.aggregate(pipeline);
  };

  /**
   * Cleanup orphaned records (khi story hoặc chapter bị xóa)
   */
  schema.statics.cleanupOrphanedRecords = async function() {
    const pipeline = [
      {
        $lookup: {
          from: 'stories',
          localField: 'story_id',
          foreignField: '_id',
          as: 'story_exists'
        }
      },
      {
        $match: {
          story_exists: { $size: 0 }
        }
      }
    ];

    const orphanedRecords = await this.aggregate(pipeline);

    if (orphanedRecords.length > 0) {
      const orphanedIds = orphanedRecords.map(record => record._id);
      await this.deleteMany({ _id: { $in: orphanedIds } });

      return {
        cleaned: orphanedRecords.length,
        message: `Cleaned up ${orphanedRecords.length} orphaned reading records`
      };
    }

    return {
      cleaned: 0,
      message: 'No orphaned records found'
    };
  };
};