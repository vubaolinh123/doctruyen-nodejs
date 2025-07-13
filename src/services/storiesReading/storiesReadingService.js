const StoriesReading = require('../../models/storiesReading');
const Chapter = require('../../models/chapter');
const Story = require('../../models/story');
const Mission = require('../../models/mission');
const MissionProgress = require('../../models/missionProgress');

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

    // Update reading progress first
    const readingResult = await StoriesReading.upsertReading(userId, storyId, enrichedChapterData, options);

    // Track mission progress for "read_chapter" missions if chapter is marked as completed
    let missionResults = null;
    if (enrichedChapterData.markCompleted || enrichedChapterData.status === 'completed') {
      try {
        missionResults = await this.trackReadChapterMissions(userId, storyId, enrichedChapterData.chapterId);
      } catch (missionError) {
        // Log mission tracking errors but don't fail the reading progress update
        console.error('[Mission Tracking] Error tracking read_chapter missions:', {
          userId,
          storyId,
          chapterId: enrichedChapterData.chapterId,
          error: missionError.message
        });
      }
    }

    // Return reading result with optional mission progress info
    return {
      ...readingResult.toObject(),
      missionProgress: missionResults
    };
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

  /**
   * Track mission progress for "read_chapter" missions
   * This method is called when a user completes reading a chapter
   */
  async trackReadChapterMissions(userId, storyId, chapterId) {
    console.log('[Mission Tracking] Starting read_chapter mission tracking:', {
      userId,
      storyId,
      chapterId
    });

    try {
      // Get all active missions that have read_chapter requirements (main or sub-missions)
      const readChapterMissions = await Mission.find({
        $or: [
          { 'requirement.type': 'read_chapter' }, // Main mission is read_chapter type
          { 'subMissions.requirement.type': 'read_chapter' } // Has read_chapter sub-missions
        ],
        status: true
      });

      if (readChapterMissions.length === 0) {
        console.log('[Mission Tracking] No active read_chapter missions found');
        return null;
      }

      console.log('[Mission Tracking] Found active read_chapter missions:', {
        count: readChapterMissions.length,
        missions: readChapterMissions.map(m => ({
          id: m._id,
          title: m.title,
          type: m.type,
          requirement: m.requirement
        }))
      });

      const missionResults = [];

      // Process each mission
      for (const mission of readChapterMissions) {
        try {
          // Check if this chapter read should count towards the mission
          const shouldCount = await this.shouldCountForMission(userId, storyId, chapterId, mission);

          if (!shouldCount) {
            console.log('[Mission Tracking] Chapter read does not count for mission:', {
              missionId: mission._id,
              missionTitle: mission.title,
              reason: 'Conditions not met or already counted'
            });
            continue;
          }

          // Update main mission progress only if main requirement is read_chapter type
          let progressResult = null;
          if (mission.requirement.type === 'read_chapter') {
            progressResult = await MissionProgress.updateProgress(
              userId,
              mission._id,
              1, // Increment by 1 for each completed chapter
              true // Increment mode
            );
          } else {
            // If main mission is not read_chapter type, get existing progress without updating
            const date = new Date();
            progressResult = await MissionProgress.findOne({
              user_id: userId,
              mission_id: mission._id,
              year: date.getFullYear(),
              month: date.getMonth(),
              day: date.getDate()
            }) || {
              current_progress: 0,
              completed: false
            };
          }

          // Update sub-mission progress if applicable
          let subMissionResults = [];
          if (mission.subMissions && mission.subMissions.length > 0) {
            for (let subIndex = 0; subIndex < mission.subMissions.length; subIndex++) {
              const subMission = mission.subMissions[subIndex];

              // Check if this reading action should count for this sub-mission
              if (subMission.requirement.type === 'read_chapter') {
                try {
                  const subProgressResult = await MissionProgress.updateSubMissionProgress(
                    userId,
                    mission._id,
                    subIndex,
                    1, // Increment by 1 for each chapter read
                    true // Increment mode
                  );

                  subMissionResults.push({
                    sub_mission_index: subIndex,
                    sub_mission_title: subMission.title,
                    sub_mission_type: subMission.requirement.type,
                    sub_mission_progress: subProgressResult.sub_progress.find(sp => sp.sub_mission_index === subIndex)
                  });

                  console.log('[Mission Tracking] Sub-mission progress updated:', {
                    missionId: mission._id,
                    subMissionIndex: subIndex,
                    subMissionTitle: subMission.title,
                    subMissionType: subMission.requirement.type
                  });
                } catch (subMissionError) {
                  console.error('[Mission Tracking] Error updating sub-mission progress:', {
                    missionId: mission._id,
                    subMissionIndex: subIndex,
                    error: subMissionError.message
                  });
                }
              }
            }
          }

          // CROSS-SERVICE SUB-MISSION TRACKING: Update sub-missions for other mission types
          // For example, if this is a comment-type mission with read_chapter sub-missions
          if (mission.requirement.type !== 'read_chapter' && mission.subMissions && mission.subMissions.length > 0) {
            for (let subIndex = 0; subIndex < mission.subMissions.length; subIndex++) {
              const subMission = mission.subMissions[subIndex];

              // If this is a non-read_chapter mission (e.g., comment) with read_chapter sub-missions
              if (subMission.requirement.type === 'read_chapter') {
                try {
                  const subProgressResult = await MissionProgress.updateSubMissionProgress(
                    userId,
                    mission._id,
                    subIndex,
                    1, // Increment by 1 for each chapter read
                    true // Increment mode
                  );

                  subMissionResults.push({
                    sub_mission_index: subIndex,
                    sub_mission_title: subMission.title,
                    sub_mission_type: subMission.requirement.type,
                    sub_mission_progress: subProgressResult.sub_progress.find(sp => sp.sub_mission_index === subIndex)
                  });

                  console.log('[Mission Tracking] Cross-service sub-mission progress updated:', {
                    missionId: mission._id,
                    missionType: mission.requirement.type,
                    subMissionIndex: subIndex,
                    subMissionTitle: subMission.title,
                    subMissionType: subMission.requirement.type
                  });
                } catch (subMissionError) {
                  console.error('[Mission Tracking] Error updating cross-service sub-mission progress:', {
                    missionId: mission._id,
                    subMissionIndex: subIndex,
                    error: subMissionError.message
                  });
                }
              }
            }
          }

          console.log('[Mission Tracking] Mission progress updated:', {
            missionId: mission._id,
            missionTitle: mission.title,
            missionType: mission.type,
            previousProgress: progressResult.current_progress - 1,
            newProgress: progressResult.current_progress,
            required: mission.requirement.count,
            completed: progressResult.completed,
            subMissionsUpdated: subMissionResults.length
          });

          missionResults.push({
            mission_id: mission._id,
            mission_title: mission.title,
            mission_type: mission.type,
            previous_progress: progressResult.current_progress - 1,
            new_progress: progressResult.current_progress,
            required: mission.requirement.count,
            completed: progressResult.completed,
            newly_completed: progressResult.completed && (progressResult.current_progress - 1) < mission.requirement.count,
            sub_missions: subMissionResults
          });

        } catch (missionError) {
          console.error('[Mission Tracking] Error updating individual mission:', {
            missionId: mission._id,
            missionTitle: mission.title,
            error: missionError.message
          });
          // Continue with other missions even if one fails
        }
      }

      console.log('[Mission Tracking] Mission tracking completed:', {
        userId,
        totalMissionsProcessed: readChapterMissions.length,
        successfulUpdates: missionResults.length,
        newlyCompletedMissions: missionResults.filter(r => r.newly_completed).length
      });

      return missionResults.length > 0 ? missionResults : null;

    } catch (error) {
      console.error('[Mission Tracking] Error in trackReadChapterMissions:', {
        userId,
        storyId,
        chapterId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if a chapter read should count towards a specific mission
   * Implements idempotency and mission-specific conditions
   */
  async shouldCountForMission(userId, storyId, chapterId, mission) {
    try {
      // Basic validation
      if (!mission.requirement || mission.requirement.type !== 'read_chapter') {
        return false;
      }

      // Check mission-specific conditions if any
      const conditions = mission.requirement.conditions || {};

      // Example conditions that could be implemented:
      // - Specific story categories
      // - Minimum chapter length
      // - Story completion status
      // - Time-based restrictions

      if (conditions.story_categories && conditions.story_categories.length > 0) {
        // Check if story belongs to required categories
        const story = await Story.findById(storyId).select('categories');
        if (!story || !story.categories) {
          return false;
        }

        const hasRequiredCategory = conditions.story_categories.some(category =>
          story.categories.includes(category)
        );

        if (!hasRequiredCategory) {
          console.log('[Mission Tracking] Story does not match required categories:', {
            missionId: mission._id,
            requiredCategories: conditions.story_categories,
            storyCategories: story.categories
          });
          return false;
        }
      }

      // Idempotency check: Ensure the same chapter read doesn't count multiple times
      // This is handled by checking if we've already counted this specific chapter today/week
      const today = new Date();
      const day = today.getDate();
      const month = today.getMonth();
      const year = today.getFullYear();

      // For daily missions, check if we've already counted this chapter today
      // For weekly missions, check if we've already counted this chapter this week
      const timeQuery = mission.type === 'daily'
        ? { day, month, year }
        : {
            year,
            week: Math.ceil((today - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000))
          };

      // Check if there's already a progress record for this mission and time period
      const existingProgress = await MissionProgress.findOne({
        user_id: userId,
        mission_id: mission._id,
        ...timeQuery
      });

      // For now, we'll allow multiple chapter reads to count towards the same mission
      // In the future, we could add more sophisticated tracking to prevent duplicate counting
      // of the same chapter within the same time period

      console.log('[Mission Tracking] Mission conditions check passed:', {
        missionId: mission._id,
        missionTitle: mission.title,
        missionType: mission.type,
        hasExistingProgress: !!existingProgress,
        currentProgress: existingProgress?.current_progress || 0
      });

      return true;

    } catch (error) {
      console.error('[Mission Tracking] Error in shouldCountForMission:', {
        userId,
        storyId,
        chapterId,
        missionId: mission._id,
        error: error.message
      });
      return false;
    }
  }
}

module.exports = new StoriesReadingService();