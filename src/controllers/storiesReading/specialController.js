const storiesReadingService = require('../../services/storiesReading/storiesReadingService');

/**
 * Controller xử lý các chức năng đặc biệt của lịch sử đọc truyện
 * Cập nhật để hỗ trợ schema mới và các tính năng nâng cao
 */
class StoriesReadingSpecialController {
  /**
   * Tìm lịch sử đọc theo user_id và story_id
   * CRITICAL FIX: Return empty object instead of 404 when no reading history exists
   */
  async findByUserAndStory(req, res) {
    try {
      const { userId, storyId } = req.params;

      console.log('[StoriesReading] findByUserAndStory request:', { userId, storyId });

      if (!userId || !storyId) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Story ID are required'
        });
      }

      const item = await storiesReadingService.findByUserAndStory(userId, storyId);

      // CRITICAL FIX: Return empty object instead of 404 for reading progress compatibility
      if (!item) {
        console.log('[StoriesReading] No reading history found, returning empty object');
        return res.json({
          success: true,
          data: null,
          message: 'No reading history found - this is normal for new readers'
        });
      }

      console.log('[StoriesReading] Reading history found:', {
        userId,
        storyId,
        hasData: !!item,
        currentChapter: item.current_chapter?.chapter_id || null
      });

      res.json({
        success: true,
        data: item
      });
    } catch (err) {
      console.error('Error in findByUserAndStory:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Lấy danh sách lịch sử đọc của người dùng với filtering nâng cao
   */
  async findByUser(req, res) {
    try {
      const { userId } = req.params;
      const {
        status,
        limit = 10,
        skip = 0,
        sort = 'last_read_at',
        includeCompleted = 'true'
      } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const options = {
        status,
        limit: parseInt(limit),
        skip: parseInt(skip),
        includeCompleted: includeCompleted === 'true'
      };

      // Xử lý sort options
      if (sort === 'last_read_at') {
        options.sort = { 'reading_stats.last_read_at': -1 };
      } else if (sort === 'name') {
        options.sort = { 'story.name': 1 };
      } else if (sort === 'progress') {
        options.sort = { 'reading_stats.completed_chapters': -1 };
      }

      const items = await storiesReadingService.findByUser(userId, options);

      res.json({
        success: true,
        data: items
      });
    } catch (err) {
      console.error('Error in findByUser:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Cập nhật hoặc tạo mới lịch sử đọc (upsert pattern)
   */
  async upsertReading(req, res) {
    try {
      const { userId, storyId } = req.params;
      const {
        chapterId,
        position = 0,
        readingTime = 0,
        markCompleted = false
      } = req.body;

      if (!userId || !storyId || !chapterId) {
        return res.status(400).json({
          success: false,
          message: 'User ID, Story ID and Chapter ID are required'
        });
      }

      const chapterData = {
        chapterId,
        position: Math.max(0, Math.min(100, position)), // Đảm bảo position trong khoảng 0-100
        readingTime: Math.max(0, readingTime),
        markCompleted
      };

      const result = await storiesReadingService.upsertReading(
        userId,
        storyId,
        chapterData
      );

      // Prepare response with mission progress information
      const response = {
        success: true,
        data: result,
        message: 'Reading progress updated successfully'
      };

      // Add mission progress information if available
      if (result.missionProgress && result.missionProgress.length > 0) {
        response.missionProgress = result.missionProgress;

        // Add summary of mission updates
        const completedMissions = result.missionProgress.filter(m => m.newly_completed);
        if (completedMissions.length > 0) {
          response.message += ` | ${completedMissions.length} nhiệm vụ đã hoàn thành!`;
        }

        console.log('[Reading API] Mission progress included in response:', {
          userId,
          storyId,
          totalMissionUpdates: result.missionProgress.length,
          newlyCompletedMissions: completedMissions.length
        });
      }

      res.json(response);
    } catch (err) {
      console.error('Error in upsertReading:', err);
      res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Cập nhật trạng thái đọc
   */
  async updateReadingStatus(req, res) {
    try {
      const { userId, storyId } = req.params;
      const { status } = req.body;

      if (!userId || !storyId || !status) {
        return res.status(400).json({
          success: false,
          message: 'User ID, Story ID and Status are required'
        });
      }

      const validStatuses = ['reading', 'completed', 'paused', 'dropped', 'plan_to_read'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const item = await storiesReadingService.updateReadingStatus(
        userId,
        storyId,
        status
      );

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Reading history not found'
        });
      }

      res.json({
        success: true,
        data: item,
        message: 'Reading status updated successfully'
      });
    } catch (err) {
      console.error('Error in updateReadingStatus:', err);
      res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Thêm bookmark (tương thích với frontend API)
   */
  async addBookmark(req, res) {
    try {
      const { userId, storyId } = req.params;
      const { storyId: bodyStoryId, chapterId, note = '' } = req.body;

      // Kiểm tra quyền truy cập - user chỉ có thể tạo bookmark cho chính mình
      // Convert both to strings for proper comparison (req.user.id is ObjectId, userId is string)
      if (req.user.id.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Không có quyền tạo bookmark cho người dùng khác'
        });
      }

      // Sử dụng storyId từ params hoặc body
      const finalStoryId = bodyStoryId || storyId;

      if (!userId || !finalStoryId || !chapterId) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc: userId, storyId, chapterId'
        });
      }

      const bookmarkData = {
        chapterId,
        position: 0, // Không sử dụng position trong hệ thống mới
        note: note.trim()
      };

      const item = await storiesReadingService.addBookmark(
        userId,
        finalStoryId,
        bookmarkData
      );

      res.json({
        success: true,
        data: item,
        message: 'Đã cập nhật/tạo mới bookmark thành công'
      });
    } catch (err) {
      console.error('Error in addBookmark:', err);
      res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Xóa bookmark
   */
  async removeBookmark(req, res) {
    try {
      const { userId, storyId, bookmarkId } = req.params;

      if (!userId || !storyId || !bookmarkId) {
        return res.status(400).json({
          success: false,
          message: 'User ID, Story ID and Bookmark ID are required'
        });
      }

      const item = await storiesReadingService.removeBookmark(
        userId,
        storyId,
        bookmarkId
      );

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Reading history or bookmark not found'
        });
      }

      res.json({
        success: true,
        data: item,
        message: 'Bookmark removed successfully'
      });
    } catch (err) {
      console.error('Error in removeBookmark:', err);
      res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Lấy tất cả bookmarks của một story
   */
  async getBookmarks(req, res) {
    try {
      const { userId, storyId } = req.params;

      if (!userId || !storyId) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Story ID are required'
        });
      }

      const readingHistory = await storiesReadingService.findByUserAndStory(userId, storyId);

      if (!readingHistory) {
        return res.json({
          success: true,
          data: []
        });
      }

      res.json({
        success: true,
        data: readingHistory.bookmarks || []
      });
    } catch (err) {
      console.error('Error in getBookmarks:', err);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }



  /**
   * Cập nhật ghi chú cá nhân
   */
  async updatePersonalNotes(req, res) {
    try {
      const { userId, storyId } = req.params;
      const { notes } = req.body;

      if (!userId || !storyId) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Story ID are required'
        });
      }

      const item = await storiesReadingService.updatePersonalNotes(
        userId,
        storyId,
        notes || ''
      );

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Reading history not found'
        });
      }

      res.json({
        success: true,
        data: item,
        message: 'Personal notes updated successfully'
      });
    } catch (err) {
      console.error('Error in updatePersonalNotes:', err);
      res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Lấy thống kê đọc của user
   */
  async getUserReadingStats(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const stats = await storiesReadingService.getUserReadingStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (err) {
      console.error('Error in getUserReadingStats:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Lấy danh sách truyện đang đọc gần đây
   */
  async getRecentlyRead(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 5 } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const items = await storiesReadingService.getRecentlyRead(
        userId,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: items
      });
    } catch (err) {
      console.error('Error in getRecentlyRead:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Tìm kiếm trong lịch sử đọc
   */
  async searchReadingHistory(req, res) {
    try {
      const { userId } = req.params;
      const { q: searchTerm, status, limit = 10, skip = 0 } = req.query;

      if (!userId || !searchTerm) {
        return res.status(400).json({
          success: false,
          message: 'User ID and search term are required'
        });
      }

      const options = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        status
      };

      const items = await storiesReadingService.searchReadingHistory(
        userId,
        searchTerm,
        options
      );

      res.json({
        success: true,
        data: items
      });
    } catch (err) {
      console.error('Error in searchReadingHistory:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Lấy tất cả bookmarks của user từ tất cả stories
   */
  async getAllUserBookmarks(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50, skip = 0, sort = 'created_at' } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Kiểm tra quyền truy cập - user chỉ có thể xem bookmark của chính mình
      // Allow access if user is authenticated and viewing their own bookmarks
      // Convert both to strings for proper comparison (req.user.id is ObjectId, userId is string)
      if (req.user && req.user.id.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Không có quyền xem bookmark của người dùng khác'
        });
      }

      const options = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        sort
      };

      const result = await storiesReadingService.getAllUserBookmarks(userId, options);

      res.json({
        success: true,
        data: result.bookmarks,
        pagination: {
          total: result.total,
          totalPages: result.totalPages,
          currentPage: result.currentPage,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      });
    } catch (err) {
      console.error('Error in getAllUserBookmarks:', err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Xóa toàn bộ lịch sử đọc của user cho một story (bao gồm tất cả bookmarks)
   */
  async deleteUserStoryReading(req, res) {
    try {
      const { userId, storyId } = req.params;

      if (!userId || !storyId) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Story ID are required'
        });
      }

      const result = await storiesReadingService.deleteUserStoryReading(userId, storyId);

      res.json({
        success: true,
        message: result.message,
        data: result.deletedRecord
      });
    } catch (err) {
      console.error('Error in deleteUserStoryReading:', err);

      if (err.message.includes('Không tìm thấy')) {
        return res.status(404).json({
          success: false,
          message: err.message
        });
      }

      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
}

module.exports = new StoriesReadingSpecialController();