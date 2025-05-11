const storiesReadingService = require('../../services/storiesReading/storiesReadingService');

/**
 * Controller xử lý các chức năng đặc biệt của lịch sử đọc truyện
 */
class StoriesReadingSpecialController {
  /**
   * Tìm lịch sử đọc theo user_id và story_id
   */
  async findByUserAndStory(req, res) {
    try {
      const { userId, storyId } = req.params;
      
      if (!userId || !storyId) {
        return res.status(400).json({ 
          error: 'User ID and Story ID are required' 
        });
      }
      
      const item = await storiesReadingService.findByUserAndStory(userId, storyId);
      
      if (!item) {
        return res.status(404).json({ 
          error: 'Reading history not found' 
        });
      }
      
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Lấy danh sách lịch sử đọc của người dùng
   */
  async findByUser(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 10, skip = 0 } = req.query;
      
      if (!userId) {
        return res.status(400).json({ 
          error: 'User ID is required' 
        });
      }
      
      const items = await storiesReadingService.findByUser(
        userId, 
        parseInt(limit), 
        parseInt(skip)
      );
      
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Cập nhật hoặc tạo mới lịch sử đọc
   */
  async upsertReading(req, res) {
    try {
      const { userId, storyId } = req.params;
      const { chapterId, position = 0 } = req.body;
      
      if (!userId || !storyId || !chapterId) {
        return res.status(400).json({ 
          error: 'User ID, Story ID and Chapter ID are required' 
        });
      }
      
      const item = await storiesReadingService.upsertReading(
        userId, 
        storyId, 
        chapterId, 
        position
      );
      
      res.json(item);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Cập nhật chapter đã đọc
   */
  async updateChapterRead(req, res) {
    try {
      const { userId, storyId } = req.params;
      const { chapterId } = req.body;
      
      if (!userId || !storyId || !chapterId) {
        return res.status(400).json({ 
          error: 'User ID, Story ID and Chapter ID are required' 
        });
      }
      
      const item = await storiesReadingService.updateChapterRead(
        userId, 
        storyId, 
        chapterId
      );
      
      if (!item) {
        return res.status(404).json({ 
          error: 'Reading history not found' 
        });
      }
      
      res.json(item);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = new StoriesReadingSpecialController(); 