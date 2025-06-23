const User = require('../../models/user');
const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const UserPurchases = require('../../models/userPurchases');
const PurchasedStory = require('../../models/purchasedStory');
const Transaction = require('../../models/transaction');

/**
 * Service xử lý logic nghiệp vụ cho mua hàng
 */
class PurchaseService {
  /**
   * Mua truyện
   * @param {string} userId - ID người dùng
   * @param {string} storyId - ID truyện
   * @returns {Object} - Kết quả mua hàng
   */
  async purchaseStory(userId, storyId) {
    try {
      // Kiểm tra user tồn tại
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Người dùng không tồn tại');
      }

      // Kiểm tra story tồn tại và có phải trả phí không
      const story = await Story.findById(storyId);
      if (!story) {
        throw new Error('Truyện không tồn tại');
      }

      // Business Rule 1: Chỉ cho phép mua story nếu story.isPaid = true
      if (!story.isPaid || !story.price || story.price <= 0) {
        throw new Error('Truyện này không cần mua hoặc không phải truyện trả phí');
      }

      // Kiểm tra đã mua chưa
      const alreadyPurchased = await UserPurchases.checkStoryPurchased(userId, storyId);
      if (alreadyPurchased) {
        throw new Error('Bạn đã mua truyện này rồi');
      }

      // Kiểm tra số xu đủ không
      if (user.coin < story.price) {
        throw new Error(`Số xu không đủ. Cần ${story.price} xu, bạn có ${user.coin} xu`);
      }

      // Trừ xu của user
      await user.deductCoins(story.price, 'Mua truyện: ' + story.name);

      // Tạo transaction
      const transaction = await Transaction.createTransaction({
        user_id: userId,
        description: `Mua Truyện: ${story.name}`,
        type: 'purchase',
        coin_change: -story.price,
        balance_after: user.coin,
        reference_type: 'story',
        reference_id: storyId,
        metadata: {
          story_name: story.name,
          story_slug: story.slug,
          purchase_type: 'story'
        }
      });

      // Lưu vào UserPurchases (new system)
      const userPurchases = await UserPurchases.purchaseStory(
        userId, 
        storyId, 
        story.price, 
        transaction._id
      );

      // Lưu vào PurchasedStory (backward compatibility)
      await PurchasedStory.purchaseStory(
        userId, 
        storyId, 
        story.price, 
        transaction._id
      );

      return {
        success: true,
        message: `Đã mua truyện "${story.name}" thành công`,
        data: {
          story: {
            id: story._id,
            name: story.name,
            slug: story.slug,
            price: story.price
          },
          transaction: {
            id: transaction._id,
            amount: story.price,
            balance_after: user.coin
          },
          purchase_date: new Date()
        }
      };

    } catch (error) {
      console.error('[PurchaseService.purchaseStory] Error:', error);
      throw error;
    }
  }

  /**
   * Mua chapter
   * @param {string} userId - ID người dùng
   * @param {string} chapterId - ID chapter
   * @returns {Object} - Kết quả mua hàng
   */
  async purchaseChapter(userId, chapterId) {
    try {
      // Kiểm tra user tồn tại
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Người dùng không tồn tại');
      }

      // Kiểm tra chapter tồn tại và có phải trả phí không
      const chapter = await Chapter.findById(chapterId).populate('story_id', 'name slug isPaid');
      if (!chapter) {
        throw new Error('Chapter không tồn tại');
      }

      // Business Rule 2: Chỉ cho phép mua chapter nếu story.isPaid = false
      if (chapter.story_id.isPaid) {
        throw new Error('Không thể mua chapter riêng lẻ cho truyện trả phí. Vui lòng mua cả truyện.');
      }

      if (!chapter.isPaid) {
        throw new Error('Chapter này không cần mua');
      }

      // Kiểm tra đã mua chưa
      const alreadyPurchased = await UserPurchases.checkChapterPurchased(userId, chapterId);
      if (alreadyPurchased) {
        throw new Error('Bạn đã mua chapter này rồi');
      }

      // Kiểm tra số xu đủ không
      if (user.coin < chapter.price) {
        throw new Error(`Số xu không đủ. Cần ${chapter.price} xu, bạn có ${user.coin} xu`);
      }

      // Trừ xu của user
      await user.deductCoins(chapter.price, `Mua chapter: ${chapter.name}`);

      // Tạo transaction
      const transaction = await Transaction.createTransaction({
        user_id: userId,
        description: `Mua Chapter: ${chapter.name} - ${chapter.story_id.name}`,
        type: 'purchase',
        coin_change: -chapter.price,
        balance_after: user.coin,
        reference_type: 'chapter',
        reference_id: chapterId,
        metadata: {
          chapter_name: chapter.name,
          chapter_number: chapter.chapter,
          story_name: chapter.story_id.name,
          story_slug: chapter.story_id.slug,
          purchase_type: 'chapter'
        }
      });

      // Lưu vào UserPurchases
      const userPurchases = await UserPurchases.purchaseChapter(
        userId, 
        chapterId, 
        chapter.story_id._id, 
        chapter.price, 
        transaction._id
      );

      return {
        success: true,
        message: `Đã mua chapter "${chapter.name}" thành công`,
        data: {
          chapter: {
            id: chapter._id,
            name: chapter.name,
            number: chapter.chapter,
            price: chapter.price
          },
          story: {
            id: chapter.story_id._id,
            name: chapter.story_id.name,
            slug: chapter.story_id.slug
          },
          transaction: {
            id: transaction._id,
            amount: chapter.price,
            balance_after: user.coin
          },
          purchase_date: new Date()
        }
      };

    } catch (error) {
      console.error('[PurchaseService.purchaseChapter] Error:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra quyền truy cập nội dung với business logic mới
   * @param {string|null} userId - ID người dùng (có thể null nếu chưa đăng nhập)
   * @param {string} storyId - ID truyện
   * @param {string} chapterId - ID chapter (optional)
   * @returns {Object} - Thông tin quyền truy cập
   */
  async checkAccess(userId, storyId, chapterId = null) {
    try {
      console.log(`[PurchaseService.checkAccess] 🔍 DEBUGGING PURCHASE VALIDATION`);
      console.log(`[PurchaseService.checkAccess] userId: ${userId}`);
      console.log(`[PurchaseService.checkAccess] storyId: ${storyId}`);
      console.log(`[PurchaseService.checkAccess] chapterId: ${chapterId}`);
      // Kiểm tra story có tồn tại không
      const story = await Story.findById(storyId);
      if (!story) {
        throw new Error('Truyện không tồn tại');
      }

      // Business Rule 1: Paid Stories (Story-level purchase)
      if (story.isPaid) {
        // Nếu story trả phí, tất cả chapters đều free sau khi mua story
        if (!userId) {
          return {
            hasAccess: false,
            reason: 'story_not_purchased',
            message: `Cần đăng nhập và mua truyện này (${story.price || 0} xu)`,
            prices: {
              story: story.price || 0
            }
          };
        }

        // Kiểm tra đã mua story chưa
        const storyPurchased = await UserPurchases.checkStoryPurchased(userId, storyId);
        if (storyPurchased) {
          return {
            hasAccess: true,
            reason: 'story_purchased',
            message: 'Đã mua cả truyện - tất cả chapters miễn phí'
          };
        }

        return {
          hasAccess: false,
          reason: 'story_not_purchased',
          message: `Cần mua truyện này (${story.price || 0} xu) để đọc tất cả chapters`,
          prices: {
            story: story.price || 0
          }
        };
      }

      // Business Rule 2: Free Stories with Paid Chapters (Chapter-level purchase)
      if (!story.isPaid) {
        // Nếu không có chapterId, cho phép truy cập story (vì story free)
        if (!chapterId) {
          return {
            hasAccess: true,
            reason: 'free_content',
            message: 'Truyện miễn phí'
          };
        }

        // Kiểm tra chapter cụ thể
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
          throw new Error('Chapter không tồn tại');
        }

        // Nếu chapter không trả phí, cho phép truy cập
        if (!chapter.isPaid) {
          return {
            hasAccess: true,
            reason: 'free_content',
            message: 'Chapter miễn phí'
          };
        }

        // Chapter trả phí - cần kiểm tra purchase
        if (!userId) {
          return {
            hasAccess: false,
            reason: 'chapter_not_purchased',
            message: `Cần đăng nhập và mua chapter này (${chapter.price || 0} xu)`,
            prices: {
              chapter: chapter.price || 0
            }
          };
        }

        // Kiểm tra đã mua chapter chưa
        console.log(`[PurchaseService.checkAccess] 🔍 Checking chapter purchase for userId: ${userId}, chapterId: ${chapterId}`);
        const chapterPurchased = await UserPurchases.checkChapterPurchased(userId, chapterId);
        console.log(`[PurchaseService.checkAccess] 📊 Chapter purchase result: ${chapterPurchased}`);

        if (chapterPurchased) {
          console.log(`[PurchaseService.checkAccess] ✅ Chapter access granted - user has purchased chapter`);
          return {
            hasAccess: true,
            reason: 'chapter_purchased',
            message: 'Đã mua chapter này'
          };
        }

        console.log(`[PurchaseService.checkAccess] ❌ Chapter access denied - user has not purchased chapter`);

        return {
          hasAccess: false,
          reason: 'chapter_not_purchased',
          message: `Cần mua chapter này (${chapter.price || 0} xu)`,
          prices: {
            chapter: chapter.price || 0
          }
        };
      }

      // Fallback - không nên đến đây với business logic mới
      return {
        hasAccess: false,
        reason: 'unknown_error',
        message: 'Lỗi không xác định khi kiểm tra quyền truy cập'
      };

    } catch (error) {
      console.error('[PurchaseService.checkAccess] Error:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách purchases của user
   * @param {string} userId - ID người dùng
   * @returns {Object} - Danh sách purchases
   */
  async getUserPurchases(userId) {
    try {
      const userPurchases = await UserPurchases.getUserPurchases(userId);
      
      if (!userPurchases) {
        return {
          success: true,
          data: {
            purchasedStories: [],
            purchasedChapters: [],
            stats: {
              total_stories_purchased: 0,
              total_chapters_purchased: 0,
              total_coins_spent: 0,
              first_purchase_date: null,
              last_purchase_date: null
            }
          }
        };
      }

      return {
        success: true,
        data: {
          purchasedStories: userPurchases.purchasedStories.filter(p => p.status === 'active'),
          purchasedChapters: userPurchases.purchasedChapters.filter(p => p.status === 'active'),
          stats: userPurchases.stats
        }
      };

    } catch (error) {
      console.error('[PurchaseService.getUserPurchases] Error:', error);
      throw error;
    }
  }
}

module.exports = new PurchaseService();
