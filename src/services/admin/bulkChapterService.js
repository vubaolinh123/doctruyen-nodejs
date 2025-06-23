const Chapter = require('../../models/chapter');
const Story = require('../../models/story');
const hasPaidChaptersService = require('../story/hasPaidChaptersService');

/**
 * Service xử lý bulk operations cho chapters
 */
class BulkChapterService {
  /**
   * Cập nhật hàng loạt chapters
   * @param {Object} options - Tùy chọn cập nhật
   * @returns {Object} - Kết quả cập nhật
   */
  async bulkUpdateChapters(options) {
    try {
      const {
        storyId,
        chapterIds,
        updateData,
        adminInfo
      } = options;

      console.log(`[BulkChapterService] Starting bulk update - storyId: ${storyId}, chapterIds: ${chapterIds?.length}, updateData:`, updateData);

      // Validate input
      if (!updateData || Object.keys(updateData).length === 0) {
        throw new Error('Update data is required');
      }

      // Build query
      let query = {};
      
      if (storyId) {
        // Kiểm tra story tồn tại
        const story = await Story.findById(storyId);
        if (!story) {
          throw new Error('Story not found');
        }
        query.story_id = storyId;
      }

      if (chapterIds && chapterIds.length > 0) {
        query._id = { $in: chapterIds };
      }

      // Nếu không có điều kiện nào, throw error
      if (Object.keys(query).length === 0) {
        throw new Error('Either storyId or chapterIds must be provided');
      }

      // Validate updateData fields
      const allowedFields = ['isPaid', 'price', 'status', 'show_ads', 'is_new'];
      const updateFields = {};
      
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updateFields[key] = value;
        }
      }

      if (Object.keys(updateFields).length === 0) {
        throw new Error('No valid update fields provided');
      }

      // Validate price if provided
      if (updateFields.price !== undefined) {
        const price = Number(updateFields.price);
        if (isNaN(price) || price < 0) {
          throw new Error('Price must be a non-negative number');
        }
        updateFields.price = price;
      }

      // Validate isPaid if provided
      if (updateFields.isPaid !== undefined) {
        updateFields.isPaid = Boolean(updateFields.isPaid);
      }

      // Get chapters before update for logging
      const chaptersBeforeUpdate = await Chapter.find(query).select('_id name chapter story_id isPaid price');
      
      if (chaptersBeforeUpdate.length === 0) {
        throw new Error('No chapters found matching the criteria');
      }

      console.log(`[BulkChapterService] Found ${chaptersBeforeUpdate.length} chapters to update`);

      // Perform bulk update
      const updateResult = await Chapter.updateMany(query, { $set: updateFields });

      // Get updated chapters for response
      const updatedChapters = await Chapter.find(query)
        .select('_id name chapter story_id isPaid price status')
        .populate('story_id', 'name slug')
        .sort({ story_id: 1, chapter: 1 });

      // Log the operation
      console.log(`[BulkChapterService] Bulk update completed:`, {
        matched: updateResult.matchedCount,
        modified: updateResult.modifiedCount,
        query: query,
        updateFields: updateFields,
        adminInfo: adminInfo
      });

      // AUTO-UPDATE: Update hasPaidChapters for affected stories if isPaid status changed
      if (updateFields.hasOwnProperty('isPaid') && updateResult.modifiedCount > 0) {
        try {
          // Get unique story IDs from updated chapters
          const affectedStoryIds = [...new Set(updatedChapters.map(chapter => chapter.story_id._id || chapter.story_id))];

          console.log(`[BulkChapterService] Auto-updating hasPaidChapters for ${affectedStoryIds.length} stories after bulk isPaid change`);

          await hasPaidChaptersService.updateMultipleStoriesHasPaidChapters(affectedStoryIds);

          console.log(`[BulkChapterService] Successfully auto-updated hasPaidChapters for affected stories`);
        } catch (error) {
          console.error('[BulkChapterService] Error auto-updating hasPaidChapters after bulk update:', error);
          // Don't throw error - bulk update should succeed even if hasPaidChapters update fails
        }
      }

      return {
        success: true,
        message: `Successfully updated ${updateResult.modifiedCount} chapters`,
        data: {
          matched: updateResult.matchedCount,
          modified: updateResult.modifiedCount,
          updatedChapters: updatedChapters,
          updateFields: updateFields,
          query: query
        }
      };

    } catch (error) {
      console.error('[BulkChapterService] Error:', error);
      throw error;
    }
  }

  /**
   * Chuyển đổi chapters từ miễn phí sang trả phí
   * @param {Object} options - Tùy chọn chuyển đổi
   * @returns {Object} - Kết quả chuyển đổi
   */
  async convertChaptersToPaid(options) {
    try {
      const {
        storyId,
        chapterIds,
        price,
        adminInfo
      } = options;

      if (!price || price <= 0) {
        throw new Error('Valid price is required for paid chapters');
      }

      const updateData = {
        isPaid: true,
        price: Number(price)
      };

      return await this.bulkUpdateChapters({
        storyId,
        chapterIds,
        updateData,
        adminInfo
      });

    } catch (error) {
      console.error('[BulkChapterService] Convert to paid error:', error);
      throw error;
    }
  }

  /**
   * Chuyển đổi chapters từ trả phí sang miễn phí
   * @param {Object} options - Tùy chọn chuyển đổi
   * @returns {Object} - Kết quả chuyển đổi
   */
  async convertChaptersToFree(options) {
    try {
      const {
        storyId,
        chapterIds,
        adminInfo
      } = options;

      const updateData = {
        isPaid: false,
        price: 0
      };

      return await this.bulkUpdateChapters({
        storyId,
        chapterIds,
        updateData,
        adminInfo
      });

    } catch (error) {
      console.error('[BulkChapterService] Convert to free error:', error);
      throw error;
    }
  }

  /**
   * Lấy thống kê chapters theo story
   * @param {string} storyId - ID của story
   * @returns {Object} - Thống kê chapters
   */
  async getChapterStats(storyId) {
    try {
      if (!storyId) {
        throw new Error('Story ID is required');
      }

      // Kiểm tra story tồn tại
      const story = await Story.findById(storyId).select('name slug chapter_count');
      if (!story) {
        throw new Error('Story not found');
      }

      // Thống kê chapters
      const stats = await Chapter.aggregate([
        { $match: { story_id: storyId } },
        {
          $group: {
            _id: null,
            total_chapters: { $sum: 1 },
            paid_chapters: {
              $sum: { $cond: [{ $eq: ['$isPaid', true] }, 1, 0] }
            },
            free_chapters: {
              $sum: { $cond: [{ $eq: ['$isPaid', false] }, 1, 0] }
            },
            total_price: {
              $sum: { $cond: [{ $eq: ['$isPaid', true] }, '$price', 0] }
            },
            avg_price: {
              $avg: { $cond: [{ $eq: ['$isPaid', true] }, '$price', null] }
            },
            min_price: {
              $min: { $cond: [{ $eq: ['$isPaid', true] }, '$price', null] }
            },
            max_price: {
              $max: { $cond: [{ $eq: ['$isPaid', true] }, '$price', null] }
            }
          }
        }
      ]);

      const result = stats[0] || {
        total_chapters: 0,
        paid_chapters: 0,
        free_chapters: 0,
        total_price: 0,
        avg_price: 0,
        min_price: 0,
        max_price: 0
      };

      return {
        success: true,
        data: {
          story: {
            id: story._id,
            name: story.name,
            slug: story.slug,
            chapter_count: story.chapter_count
          },
          stats: result
        }
      };

    } catch (error) {
      console.error('[BulkChapterService] Get stats error:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách chapters với thông tin pricing
   * @param {string} storyId - ID của story
   * @param {Object} options - Tùy chọn lọc
   * @returns {Object} - Danh sách chapters
   */
  async getChaptersWithPricing(storyId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        isPaid = null,
        sort = 'chapter'
      } = options;

      if (!storyId) {
        throw new Error('Story ID is required');
      }

      // Build query
      const query = { story_id: storyId };
      if (isPaid !== null) {
        query.isPaid = Boolean(isPaid);
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get chapters
      const [chapters, total] = await Promise.all([
        Chapter.find(query)
          .select('_id name chapter isPaid price status createdAt')
          .sort({ [sort]: 1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Chapter.countDocuments(query)
      ]);

      return {
        success: true,
        data: {
          chapters,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };

    } catch (error) {
      console.error('[BulkChapterService] Get chapters error:', error);
      throw error;
    }
  }
}

module.exports = new BulkChapterService();
