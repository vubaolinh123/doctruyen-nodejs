const purchasedStoryService = require('../../services/purchasedStory/purchasedStoryService');

/**
 * Controller xử lý các chức năng đặc biệt của truyện đã mua
 */
class PurchasedStorySpecialController {
  /**
   * Kiểm tra người dùng đã mua truyện chưa
   */
  async checkPurchased(req, res) {
    try {
      const { userId, storyId } = req.params;
      const result = await purchasedStoryService.checkPurchased(userId, storyId);
      res.json({ purchased: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Lấy danh sách truyện đã mua của người dùng
   */
  async findByCustomer(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 10, skip = 0 } = req.query;
      const items = await purchasedStoryService.findByCustomer(
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
   * Mua truyện cho người dùng
   */
  async purchaseStory(req, res) {
    try {
      const { userId, storyId } = req.params;
      const { coinAmount, transactionId } = req.body;
      
      if (!coinAmount) {
        return res.status(400).json({ error: 'Coin amount is required' });
      }
      
      const item = await purchasedStoryService.purchaseStory(
        userId, 
        storyId, 
        coinAmount, 
        transactionId
      );
      
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = new PurchasedStorySpecialController(); 