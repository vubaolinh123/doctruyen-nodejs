const storyService = require('../../services/story/storyService');
const storyStatsService = require('../../services/storyStats/storyStatsService');
const mongoose = require('mongoose');
const slugify = require('slugify');
const BusinessLogicValidator = require('../../services/validation/businessLogicValidator');

/**
 * Lấy danh sách tất cả truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      search = '',
      status,
      approval_status,
      is_hot,
      is_new,
      is_full,
      category,
      categories,
      author,
      has_chapters,
      chapter_count,
      chapter_count_op = 'eq',
      sort_by = 'updatedAt',
      sort_order = 'desc',
      hot_day,
      hot_month,
      hot_all_time,
      updated_at_start,
      updated_at_end
    } = req.query;

    console.log(`[API] Lấy danh sách truyện - page: ${page}, limit: ${limit}, search: ${search}, categories: ${categories}`);
    console.log(`[API] Sort parameters - sort: ${sort}, sort_by: ${sort_by}, sort_order: ${sort_order}`);
    console.log(`[API] Approval status filter: ${approval_status}`);

    // Kiểm tra quyền admin nếu có token
    const isAdmin = req.user && req.user.role === 'admin';
    console.log(`[API] User info:`, {
      hasUser: !!req.user,
      userRole: req.user?.role,
      isAdmin
    });

    // Nếu có token nhưng không phải admin, trả về lỗi
    if (req.user && !isAdmin) {
      console.log(`[API] Access denied - User role: ${req.user.role}, required: admin`);
      return res.status(403).json({
        success: false,
        message: 'Forbidden - Not admin role'
      });
    }

    // Parse sort parameter to sort_by and sort_order if needed
    let finalSortBy = sort_by;
    let finalSortOrder = sort_order;

    // If sort parameter is provided and different from default, parse it
    if (sort && sort !== '-createdAt') {
      console.log(`[API] Parsing sort parameter: ${sort}`);

      if (sort.startsWith('-')) {
        // Descending order (e.g., "-views" -> sort_by="views", sort_order="desc")
        finalSortBy = sort.substring(1);
        finalSortOrder = 'desc';
      } else {
        // Ascending order (e.g., "views" -> sort_by="views", sort_order="asc")
        finalSortBy = sort;
        finalSortOrder = 'asc';
      }

      console.log(`[API] Converted sort: ${sort} -> sort_by="${finalSortBy}", sort_order="${finalSortOrder}"`);
    }

    // Xây dựng options
    const options = {
      page,
      limit,
      // Remove original sort parameter to avoid conflicts
      search,
      status,
      approval_status,
      is_hot,
      is_new,
      is_full,
      category,
      categories,
      author,
      has_chapters,
      chapter_count,
      chapter_count_op,
      sort_by: finalSortBy,
      sort_order: finalSortOrder,
      hot_day,
      hot_month,
      hot_all_time,
      updated_at_start,
      updated_at_end,
      // Thêm flag để biết đây là request từ admin
      isAdminRequest: isAdmin
    };

    // Log để debug
    console.log(`[API] Chapter filters - chapter_count: ${chapter_count}, chapter_count_op: ${chapter_count_op}, has_chapters: ${has_chapters}`);
    console.log(`[API] Final sort params - sort_by: ${finalSortBy}, sort_order: ${finalSortOrder}`);
    console.log(`[API] Hot filters - hot_day: ${hot_day}, hot_month: ${hot_month}, hot_all_time: ${hot_all_time}`);

    const result = await storyService.getAllStories(options);
    res.json({
      success: true,
      stories: result.items,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage
      }
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
};

/**
 * Lấy truyện theo ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] Lấy thông tin truyện - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }

    const storyData = await storyService.getStoryById(id);

    if (!storyData) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    return res.json({
      success: true,
      story: storyData
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
};

/**
 * Lấy truyện theo slug
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`[API] Lấy thông tin truyện theo slug - slug: ${slug}`);

    const item = await storyService.getStoryBySlug(slug);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    // Lấy tất cả thống kê từ StoryStats
    try {
      console.log(`[API] Lấy thống kê cho truyện ${item._id}`);
      const allStats = await storyStatsService.getAllStats(item._id);

      // Gán lại giá trị views từ StoryStats
      item.views = allStats.totalViews;
      console.log(`[API] Tổng lượt xem cho truyện ${item._id}: ${item.views}`);

      // Gán lại giá trị ratings từ StoryStats
      item.ratings_count = allStats.ratings.ratingsCount;
      item.ratings_sum = allStats.ratings.ratingsSum;
      console.log(`[API] Thống kê đánh giá cho truyện ${item._id}: count=${item.ratings_count}, sum=${item.ratings_sum}`);

      // Thêm thông tin thống kê chi tiết
      item.stats = {
        views: {
          total: allStats.totalViews,
          byTimeRange: allStats.viewsByTimeRange,
          daily: allStats.dailyStats.views
        },
        ratings: {
          count: allStats.ratings.ratingsCount,
          sum: allStats.ratings.ratingsSum,
          average: allStats.ratings.averageRating,
          daily: {
            count: allStats.dailyStats.ratings_count,
            sum: allStats.dailyStats.ratings_sum
          }
        }
      };
    } catch (statsError) {
      console.error(`[API] Error getting stats for story ${item._id}:`, statsError);
      // Nếu có lỗi, đặt giá trị mặc định
      item.views = 0;
      item.ratings_count = 0;
      item.ratings_sum = 0;
      item.stats = {
        views: { total: 0, byTimeRange: { day: 0, week: 0, month: 0, year: 0, all: 0 }, daily: 0 },
        ratings: { count: 0, sum: 0, average: 0, daily: { count: 0, sum: 0 } }
      };
    }

    res.json({
      success: true,
      story: item
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
};

/**
 * Tạo truyện mới
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.create = async (req, res) => {
  try {
    const {
      name,
      slug,
      image,
      banner,
      desc,
      author_id,
      categories,
      is_full,
      is_hot,
      is_new,
      show_ads,
      hot_day,
      hot_month,
      hot_all_time,
      status,
      isPaid,
      price,
      hasPaidChapters
    } = req.body;

    console.log(`[API] Tạo truyện mới - name: ${name}`);

    // Validate input data
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tên truyện là bắt buộc'
      });
    }

    // BUSINESS LOGIC VALIDATION using centralized validator
    try {
      BusinessLogicValidator.validateStoryBusinessLogic({ isPaid, hasPaidChapters, price });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        type: 'BUSINESS_LOGIC_VIOLATION'
      });
    }

    // Generate slug if not provided
    const storyData = {
      ...req.body,
      slug: slug || slugify(name, {
        lower: true,
        strict: true,
        locale: 'vi'
      })
    };

    const newStory = await storyService.createStory(storyData);

    return res.status(201).json({
      success: true,
      message: 'Tạo truyện thành công',
      story: newStory
    });
  } catch (err) {
    console.error('[API] Error:', err);

    // Handle duplicate slug error
    if (err.message.includes('Slug đã tồn tại')) {
      return res.status(400).json({
        success: false,
        message: 'Slug đã tồn tại, vui lòng chọn tên khác'
      });
    }

    res.status(400).json({
      success: false,
      message: 'Lỗi khi tạo truyện',
      error: err.message
    });
  }
};

/**
 * Cập nhật truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPaid, price, hasPaidChapters } = req.body;
    console.log(`[API] Cập nhật truyện - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }

    // BUSINESS LOGIC VALIDATION using centralized validator
    try {
      BusinessLogicValidator.validateStoryBusinessLogic({ isPaid, hasPaidChapters, price });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        type: 'BUSINESS_LOGIC_VIOLATION'
      });
    }

    // Tự động tạo slug nếu có name nhưng không có slug
    let { slug, name } = req.body;
    if (name && !slug) {
      slug = slugify(name, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
      req.body.slug = slug;
    }

    const updatedStory = await storyService.updateStoryWithPaidContentLogic(id, req.body);

    if (!updatedStory) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    return res.json({
      success: true,
      message: 'Cập nhật truyện thành công',
      story: updatedStory
    });
  } catch (err) {
    console.error('[API] Error:', err);

    // Handle duplicate slug error
    if (err.message.includes('Slug đã tồn tại')) {
      return res.status(400).json({
        success: false,
        message: 'Slug đã tồn tại, vui lòng chọn tên khác'
      });
    }

    res.status(400).json({
      success: false,
      message: 'Lỗi khi cập nhật truyện',
      error: err.message
    });
  }
};

/**
 * Xóa truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] Xóa truyện - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }

    // Xóa truyện
    const result = await storyService.deleteStory(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    // Nếu xóa thất bại vì có chapter liên quan
    if (result.error && result.error.includes('chapter')) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    return res.json({
      success: true,
      message: 'Xóa truyện thành công'
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
};

/**
 * Tăng lượt xem cho truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.incrementViews = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Slug là bắt buộc'
      });
    }

    const result = await storyService.incrementStoryViews(slug);
    return res.status(200).json({
      success: true,
      message: 'Tăng lượt xem thành công',
      views: result.views
    });
  } catch (err) {
    console.error('[API] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
};