const storiesReadingService = require('../../services/storiesReading/storiesReadingService');

/**
 * Controller xử lý các chức năng cơ bản của lịch sử đọc truyện
 */
class StoriesReadingBaseController {
  /**
   * Lấy tất cả lịch sử đọc truyện
   */
  async getAll(req, res) {
    try {
      const items = await storiesReadingService.getAll(req.query);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Lấy thông tin lịch sử đọc truyện theo ID
   */
  async getById(req, res) {
    try {
      const item = await storiesReadingService.getById(req.params.id);
      res.json(item);
    } catch (err) {
      if (err.message === 'Not found') {
        return res.status(404).json({ error: 'Not found' });
      }
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Tạo mới lịch sử đọc truyện
   */
  async create(req, res) {
    try {
      const item = await storiesReadingService.create(req.body);
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Cập nhật thông tin lịch sử đọc truyện
   */
  async update(req, res) {
    try {
      const item = await storiesReadingService.update(req.params.id, req.body);
      res.json(item);
    } catch (err) {
      if (err.message === 'Not found') {
        return res.status(404).json({ error: 'Not found' });
      }
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Xóa lịch sử đọc truyện
   */
  async remove(req, res) {
    try {
      const result = await storiesReadingService.remove(req.params.id);
      res.json(result);
    } catch (err) {
      if (err.message === 'Not found') {
        return res.status(404).json({ error: 'Not found' });
      }
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new StoriesReadingBaseController(); 