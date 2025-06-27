const purchaseService = require('../../services/purchase/purchaseService');

/**
 * Controller xử lý các chức năng mua hàng
 */
class PurchaseController {
  /**
   * Mua truyện
   * @route POST /api/purchase/story
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @access Private (Authenticated users)
   */
  async purchaseStory(req, res) {
    try {
      const { storyId } = req.body;
      const userId = req.user.id || req.user._id;

      console.log(`[Purchase API] User ${userId} attempting to purchase story ${storyId}`);

      if (!storyId) {
        return res.status(400).json({
          success: false,
          message: 'Story ID is required'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      const result = await purchaseService.purchaseStory(userId, storyId);

      console.log(`[Purchase API] Story purchase successful for user ${userId}, story ${storyId}`);

      return res.status(200).json(result);

    } catch (error) {
      console.error('[Purchase API] Story purchase error:', error);
      
      const statusCode = 
        error.message.includes('không tồn tại') ? 404 :
        error.message.includes('không đủ') ? 400 :
        error.message.includes('đã mua') ? 409 :
        error.message.includes('không cần mua') ? 400 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Mua chapter
   * @route POST /api/purchase/chapter
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @access Private (Authenticated users)
   */
  async purchaseChapter(req, res) {
    try {
      const { chapterId } = req.body;
      const userId = req.user.id || req.user._id;

      console.log(`[Purchase API] User ${userId} attempting to purchase chapter ${chapterId}`);

      if (!chapterId) {
        return res.status(400).json({
          success: false,
          message: 'Chapter ID is required'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      const result = await purchaseService.purchaseChapter(userId, chapterId);

      console.log(`[Purchase API] Chapter purchase successful for user ${userId}, chapter ${chapterId}`);

      return res.status(200).json(result);

    } catch (error) {
      console.error('[Purchase API] Chapter purchase error:', error);
      
      const statusCode = 
        error.message.includes('không tồn tại') ? 404 :
        error.message.includes('không đủ') ? 400 :
        error.message.includes('đã mua') ? 409 :
        error.message.includes('không cần mua') ? 400 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Kiểm tra quyền truy cập nội dung
   * @route GET /api/purchase/check-access
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @access Public (Optional authentication)
   */
  async checkAccess(req, res) {
    try {
      // CRITICAL FIX: Handle both GET (query) and POST (body) requests
      const isPostRequest = req.method === 'POST';
      const { storyId, chapterId, userId: bodyUserId } = isPostRequest ? req.body : req.query;

      // Get user ID from request user, body, or query
      const userId = bodyUserId || (req.user ? (req.user.id || req.user._id) : null);

      console.log(`[PurchaseController.checkAccess] 🔍 DEBUGGING ACCESS CHECK REQUEST`);
      console.log(`[PurchaseController.checkAccess] Method: ${req.method}`);
      console.log(`[PurchaseController.checkAccess] req.user:`, req.user ? { id: req.user.id || req.user._id, email: req.user.email } : 'null');
      console.log(`[PurchaseController.checkAccess] userId: ${userId}`);
      console.log(`[PurchaseController.checkAccess] storyId: ${storyId}`);
      console.log(`[PurchaseController.checkAccess] chapterId: ${chapterId}`);
      console.log(`[PurchaseController.checkAccess] Authorization header:`, req.headers.authorization ? 'Present' : 'Missing');

      if (!storyId) {
        return res.status(400).json({
          success: false,
          message: 'Story ID is required'
        });
      }

      const result = await purchaseService.checkAccess(userId, storyId, chapterId);

      return res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('[Purchase API] Check access error:', error);

      const statusCode = error.message.includes('không tồn tại') ? 404 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Lấy danh sách purchases của user
   * @route GET /api/purchase/my-purchases
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @access Private (Authenticated users)
   */
  async getMyPurchases(req, res) {
    try {
      const userId = req.user.id || req.user._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      const result = await purchaseService.getUserPurchases(userId);

      return res.status(200).json(result);

    } catch (error) {
      console.error('[Purchase API] Get purchases error:', error);
      
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new PurchaseController();
