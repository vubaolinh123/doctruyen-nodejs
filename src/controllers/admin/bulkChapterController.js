const bulkChapterService = require('../../services/admin/bulkChapterService');
const BusinessLogicValidator = require('../../services/validation/businessLogicValidator');

/**
 * Controller xử lý bulk operations cho chapters (Admin only)
 */
class BulkChapterController {
  /**
   * Cập nhật hàng loạt chapters
   * @route POST /api/admin/chapters/bulk-update
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @access Private (Admin only)
   */
  async bulkUpdateChapters(req, res) {
    try {
      const {
        storyId,
        chapterIds,
        updateData
      } = req.body;

      console.log(`[Admin API] Bulk update chapters - storyId: ${storyId}, chapterIds: ${chapterIds?.length}`);

      // Kiểm tra quyền admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Validate input
      if (!updateData) {
        return res.status(400).json({
          success: false,
          message: 'Update data is required'
        });
      }

      if (!storyId && (!chapterIds || chapterIds.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Either storyId or chapterIds must be provided'
        });
      }

      // Prepare admin info
      const adminInfo = {
        admin_id: req.user._id || req.user.id,
        admin_name: req.user.name || req.user.email,
        action: 'bulk_update_chapters',
        timestamp: new Date()
      };

      const result = await bulkChapterService.bulkUpdateChapters({
        storyId,
        chapterIds,
        updateData,
        adminInfo
      });

      console.log(`[Admin API] Bulk update successful - modified: ${result.data.modified} chapters`);

      return res.status(200).json(result);

    } catch (error) {
      console.error('[Admin API] Bulk update error:', error);
      
      const statusCode = 
        error.message.includes('not found') ? 404 :
        error.message.includes('required') ? 400 :
        error.message.includes('valid') ? 400 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Chuyển đổi chapters sang trả phí
   * @route POST /api/admin/chapters/convert-to-paid
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @access Private (Admin only)
   */
  async convertToPaid(req, res) {
    try {
      const {
        storyId,
        chapterIds,
        price
      } = req.body;

      console.log(`[Admin API] Convert chapters to paid - storyId: ${storyId}, price: ${price}`);

      // Kiểm tra quyền admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Validate input
      if (!price || price <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid price is required'
        });
      }

      if (!storyId && (!chapterIds || chapterIds.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Either storyId or chapterIds must be provided'
        });
      }

      // BUSINESS LOGIC VALIDATION using centralized validator
      if (storyId) {
        try {
          await BusinessLogicValidator.validateChapterPricing(storyId, { isPaid: true, price });

          // Auto-fix story model if needed
          const fixResult = await BusinessLogicValidator.autoFixStoryModel(storyId);
          if (fixResult.fixed) {
            console.log(`[Admin API] Auto-fixed story ${storyId}:`, fixResult.updates);
          }
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: error.message,
            type: 'BUSINESS_LOGIC_VIOLATION'
          });
        }
      }

      // Prepare admin info
      const adminInfo = {
        admin_id: req.user._id || req.user.id,
        admin_name: req.user.name || req.user.email,
        action: 'convert_chapters_to_paid',
        timestamp: new Date()
      };

      const result = await bulkChapterService.convertChaptersToPaid({
        storyId,
        chapterIds,
        price,
        adminInfo
      });

      console.log(`[Admin API] Convert to paid successful - modified: ${result.data.modified} chapters`);

      return res.status(200).json(result);

    } catch (error) {
      console.error('[Admin API] Convert to paid error:', error);
      
      const statusCode = 
        error.message.includes('not found') ? 404 :
        error.message.includes('required') ? 400 :
        error.message.includes('valid') ? 400 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Chuyển đổi chapters sang miễn phí
   * @route POST /api/admin/chapters/convert-to-free
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @access Private (Admin only)
   */
  async convertToFree(req, res) {
    try {
      const {
        storyId,
        chapterIds
      } = req.body;

      console.log(`[Admin API] Convert chapters to free - storyId: ${storyId}`);

      // Kiểm tra quyền admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      if (!storyId && (!chapterIds || chapterIds.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Either storyId or chapterIds must be provided'
        });
      }

      // Prepare admin info
      const adminInfo = {
        admin_id: req.user._id || req.user.id,
        admin_name: req.user.name || req.user.email,
        action: 'convert_chapters_to_free',
        timestamp: new Date()
      };

      const result = await bulkChapterService.convertChaptersToFree({
        storyId,
        chapterIds,
        adminInfo
      });

      console.log(`[Admin API] Convert to free successful - modified: ${result.data.modified} chapters`);

      return res.status(200).json(result);

    } catch (error) {
      console.error('[Admin API] Convert to free error:', error);
      
      const statusCode = 
        error.message.includes('not found') ? 404 :
        error.message.includes('required') ? 400 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Lấy thống kê chapters
   * @route GET /api/admin/chapters/stats/:storyId
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @access Private (Admin only)
   */
  async getChapterStats(req, res) {
    try {
      const { storyId } = req.params;

      // Kiểm tra quyền admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      if (!storyId) {
        return res.status(400).json({
          success: false,
          message: 'Story ID is required'
        });
      }

      const result = await bulkChapterService.getChapterStats(storyId);

      return res.status(200).json(result);

    } catch (error) {
      console.error('[Admin API] Get chapter stats error:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Lấy danh sách chapters với thông tin pricing
   * @route GET /api/admin/chapters/pricing/:storyId
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @access Private (Admin only)
   */
  async getChaptersWithPricing(req, res) {
    try {
      const { storyId } = req.params;
      const {
        page = 1,
        limit = 50,
        isPaid = null,
        sort = 'chapter'
      } = req.query;

      // Kiểm tra quyền admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      if (!storyId) {
        return res.status(400).json({
          success: false,
          message: 'Story ID is required'
        });
      }

      const result = await bulkChapterService.getChaptersWithPricing(storyId, {
        page,
        limit,
        isPaid,
        sort
      });

      return res.status(200).json(result);

    } catch (error) {
      console.error('[Admin API] Get chapters with pricing error:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 500;

      return res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new BulkChapterController();
