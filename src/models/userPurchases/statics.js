/**
 * Định nghĩa các static methods cho UserPurchases model
 * @param {Object} schema - Schema của UserPurchases
 */
module.exports = function(schema) {
  /**
   * Kiểm tra người dùng đã mua truyện chưa
   */
  schema.statics.checkStoryPurchased = async function(userId, storyId) {
    const userPurchases = await this.findOne({
      user_id: userId,
      'purchasedStories.story_id': storyId,
      'purchasedStories.status': 'active'
    });

    if (!userPurchases) {
      return false;
    }

    // Tìm purchase cụ thể
    const purchase = userPurchases.purchasedStories.find(
      p => p.story_id.toString() === storyId.toString() && p.status === 'active'
    );

    if (!purchase) {
      return false;
    }

    // Kiểm tra hết hạn
    if (purchase.expire_date && purchase.expire_date < new Date()) {
      // Cập nhật trạng thái hết hạn
      await this.updateOne(
        { 
          user_id: userId,
          'purchasedStories.story_id': storyId 
        },
        { 
          $set: { 'purchasedStories.$.status': 'expired' } 
        }
      );
      return false;
    }

    return true;
  };

  /**
   * Kiểm tra người dùng đã mua chapter chưa
   */
  schema.statics.checkChapterPurchased = async function(userId, chapterId) {
    console.log(`[UserPurchases.checkChapterPurchased] 🔍 DEBUGGING DATABASE QUERY`);
    console.log(`[UserPurchases.checkChapterPurchased] userId: ${userId}`);
    console.log(`[UserPurchases.checkChapterPurchased] chapterId: ${chapterId}`);

    const userPurchases = await this.findOne({
      user_id: userId,
      'purchasedChapters.chapter_id': chapterId,
      'purchasedChapters.status': 'active'
    });

    console.log(`[UserPurchases.checkChapterPurchased] 📊 Database query result:`, userPurchases ? 'Found user purchases' : 'No user purchases found');

    if (!userPurchases) {
      console.log(`[UserPurchases.checkChapterPurchased] ❌ No user purchases document found for userId: ${userId}`);
      return false;
    }

    console.log(`[UserPurchases.checkChapterPurchased] 📋 Found user purchases document with ${userPurchases.purchasedChapters?.length || 0} chapters`);

    // Tìm purchase cụ thể
    const purchase = userPurchases.purchasedChapters.find(
      p => p.chapter_id.toString() === chapterId.toString() && p.status === 'active'
    );

    console.log(`[UserPurchases.checkChapterPurchased] 🔍 Looking for chapter_id: ${chapterId} with status: active`);
    console.log(`[UserPurchases.checkChapterPurchased] 📊 Purchase found:`, purchase ? 'YES' : 'NO');

    if (purchase) {
      console.log(`[UserPurchases.checkChapterPurchased] 📝 Purchase details:`, {
        chapter_id: purchase.chapter_id,
        status: purchase.status,
        purchase_date: purchase.purchase_date,
        price_paid: purchase.price_paid
      });
    }

    if (!purchase) {
      console.log(`[UserPurchases.checkChapterPurchased] ❌ No matching purchase found for chapter_id: ${chapterId}`);
      return false;
    }

    // Kiểm tra hết hạn
    if (purchase.expire_date && purchase.expire_date < new Date()) {
      // Cập nhật trạng thái hết hạn
      await this.updateOne(
        { 
          user_id: userId,
          'purchasedChapters.chapter_id': chapterId 
        },
        { 
          $set: { 'purchasedChapters.$.status': 'expired' } 
        }
      );
      return false;
    }

    return true;
  };

  /**
   * Mua truyện
   */
  schema.statics.purchaseStory = async function(userId, storyId, price, transactionId = null) {
    const purchaseData = {
      story_id: storyId,
      price_paid: price,
      purchase_date: new Date(),
      transaction_id: transactionId,
      status: 'active'
    };

    const result = await this.findOneAndUpdate(
      { user_id: userId },
      {
        $push: { purchasedStories: purchaseData },
        $inc: { 
          'stats.total_stories_purchased': 1,
          'stats.total_coins_spent': price
        },
        $set: {
          'stats.last_purchase_date': new Date()
        },
        $setOnInsert: { 
          user_id: userId,
          'stats.first_purchase_date': new Date()
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    return result;
  };

  /**
   * Mua chapter
   */
  schema.statics.purchaseChapter = async function(userId, chapterId, storyId, price, transactionId = null) {
    const purchaseData = {
      chapter_id: chapterId,
      story_id: storyId,
      price_paid: price,
      purchase_date: new Date(),
      transaction_id: transactionId,
      status: 'active'
    };

    const result = await this.findOneAndUpdate(
      { user_id: userId },
      {
        $push: { purchasedChapters: purchaseData },
        $inc: { 
          'stats.total_chapters_purchased': 1,
          'stats.total_coins_spent': price
        },
        $set: {
          'stats.last_purchase_date': new Date()
        },
        $setOnInsert: { 
          user_id: userId,
          'stats.first_purchase_date': new Date()
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    return result;
  };

  /**
   * Lấy tất cả purchases của user
   */
  schema.statics.getUserPurchases = async function(userId) {
    return this.findOne({ user_id: userId })
      .populate('purchasedStories.story_id', 'name slug image')
      .populate('purchasedChapters.chapter_id', 'name chapter')
      .populate('purchasedChapters.story_id', 'name slug');
  };

  /**
   * Lấy danh sách truyện đã mua của user
   */
  schema.statics.getUserPurchasedStories = async function(userId, limit = 10, skip = 0) {
    const userPurchases = await this.findOne({ user_id: userId })
      .populate('purchasedStories.story_id', 'name slug image');

    if (!userPurchases) {
      return [];
    }

    return userPurchases.purchasedStories
      .filter(p => p.status === 'active')
      .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
      .slice(skip, skip + limit);
  };

  /**
   * Lấy danh sách chapter đã mua của user
   */
  schema.statics.getUserPurchasedChapters = async function(userId, storyId = null, limit = 10, skip = 0) {
    const query = { user_id: userId };
    
    const userPurchases = await this.findOne(query)
      .populate('purchasedChapters.chapter_id', 'name chapter')
      .populate('purchasedChapters.story_id', 'name slug');

    if (!userPurchases) {
      return [];
    }

    let chapters = userPurchases.purchasedChapters.filter(p => p.status === 'active');
    
    if (storyId) {
      chapters = chapters.filter(p => p.story_id._id.toString() === storyId.toString());
    }

    return chapters
      .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
      .slice(skip, skip + limit);
  };
};
