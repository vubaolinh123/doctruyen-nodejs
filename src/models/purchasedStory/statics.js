/**
 * Định nghĩa các static methods cho PurchasedStory model
 * @param {Object} schema - Schema của PurchasedStory
 */
module.exports = function(schema) {
  /**
   * Kiểm tra người dùng đã mua truyện chưa
   */
  schema.statics.checkPurchased = async function(userId, storyId) {
    const purchase = await this.findOne({
      user_id: userId,
      story_id: storyId,
      status: 'active'
    });

    // Nếu không tìm thấy, hoặc đã hết hạn
    if (!purchase) {
      return false;
    }

    // Nếu có ngày hết hạn và đã hết hạn
    if (purchase.expire_date && purchase.expire_date < new Date()) {
      purchase.status = 'expired';
      await purchase.save();
      return false;
    }

    return true;
  };

  /**
   * Lấy danh sách truyện đã mua của người dùng
   */
  schema.statics.findByCustomer = function(userId, limit = 10, skip = 0) {
    return this.find({
      user_id: userId,
      status: 'active'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('story', 'name slug image');
  };

  /**
   * Mua truyện
   */
  schema.statics.purchaseStory = async function(userId, storyId, coinAmount, transactionId = null) {
    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      {
        coin_bought: coinAmount,
        status: 'active',
        transaction_id: transactionId,
        $setOnInsert: { user_id: userId, story_id: storyId }
      },
      {
        new: true,
        upsert: true
      }
    );
  };
}; 