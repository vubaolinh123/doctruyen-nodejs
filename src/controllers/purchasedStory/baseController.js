const purchasedStoryService = require('../../services/purchasedStory/purchasedStoryService');

/**
 * Controller xử lý các chức năng cơ bản của truyện đã mua
 */
class PurchasedStoryBaseController {
  /**
   * Lấy tất cả truyện đã mua
   */
  async getAll(req, res) {
    try {
      const items = await purchasedStoryService.getAll(req.query);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Lấy thông tin truyện đã mua theo ID
   */
  async getById(req, res) {
    try {
      const item = await purchasedStoryService.getById(req.params.id);
      res.json(item);
    } catch (err) {
      if (err.message === 'Not found') {
        return res.status(404).json({ error: 'Not found' });
      }
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Tạo mới truyện đã mua
   */
  async create(req, res) {
    try {
      const item = await purchasedStoryService.create(req.body);
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Cập nhật thông tin truyện đã mua
   */
  async update(req, res) {
    try {
      const item = await purchasedStoryService.update(req.params.id, req.body);
      res.json(item);
    } catch (err) {
      if (err.message === 'Not found') {
        return res.status(404).json({ error: 'Not found' });
      }
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Xóa truyện đã mua
   */
  async remove(req, res) {
    try {
      const result = await purchasedStoryService.remove(req.params.id);
      res.json(result);
    } catch (err) {
      if (err.message === 'Not found') {
        return res.status(404).json({ error: 'Not found' });
      }
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new PurchasedStoryBaseController(); 