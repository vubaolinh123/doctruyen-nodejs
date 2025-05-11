const PurchasedStory = require('../../models/purchasedStory');

/**
 * Service xử lý logic nghiệp vụ cho truyện đã mua
 */
class PurchasedStoryService {
  /**
   * Lấy tất cả truyện đã mua theo điều kiện
   */
  async getAll(params) {
    const { customer_id, story_id, page = 1, limit = 10, sort = '-createdAt' } = params;
    const query = {};
    if (customer_id) query.customer_id = customer_id;
    if (story_id) query.story_id = story_id;

    return PurchasedStory.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
  }

  /**
   * Lấy thông tin truyện đã mua theo ID
   */
  async getById(id) {
    const item = await PurchasedStory.findById(id);
    if (!item) {
      throw new Error('Not found');
    }
    return item;
  }

  /**
   * Tạo mới truyện đã mua
   */
  async create(data) {
    const item = new PurchasedStory(data);
    return item.save();
  }

  /**
   * Cập nhật thông tin truyện đã mua
   */
  async update(id, data) {
    const item = await PurchasedStory.findByIdAndUpdate(id, data, { new: true });
    if (!item) {
      throw new Error('Not found');
    }
    return item;
  }

  /**
   * Xóa truyện đã mua
   */
  async remove(id) {
    const item = await PurchasedStory.findByIdAndDelete(id);
    if (!item) {
      throw new Error('Not found');
    }
    return { message: 'Deleted successfully' };
  }

  /**
   * Kiểm tra người dùng đã mua truyện chưa
   */
  async checkPurchased(userId, storyId) {
    return PurchasedStory.checkPurchased(userId, storyId);
  }

  /**
   * Lấy danh sách truyện đã mua của người dùng
   */
  async findByCustomer(userId, limit = 10, skip = 0) {
    return PurchasedStory.findByCustomer(userId, limit, skip);
  }

  /**
   * Mua truyện cho người dùng
   */
  async purchaseStory(userId, storyId, coinAmount, transactionId = null) {
    return PurchasedStory.purchaseStory(userId, storyId, coinAmount, transactionId);
  }
}

module.exports = new PurchasedStoryService(); 