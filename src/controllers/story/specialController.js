const specialStoryService = require('../../services/story/specialStoryService');
const storyService = require('../../services/story/storyService');
const Category = require('../../models/category');
const Author = require('../../models/author');
const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const mongoose = require('mongoose');

/**
 * Lấy danh sách truyện phổ biến (sắp xếp theo views)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getPopularStories = async (req, res) => {
  try {
    const { limit = 500, page = 1 } = req.query;
    console.log(`[API] Getting popular stories - limit: ${limit}, page: ${page}`);

    const stories = await specialStoryService.getPopularStories(parseInt(limit), parseInt(page));

    res.json({
      success: true,
      stories: stories.stories || stories,
      total: stories.total || stories.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('[API] Error getting popular stories:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * Lấy danh sách truyện hot
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getHotStories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await specialStoryService.getHotStories(parseInt(limit));
    res.json({
      success: true,
      stories
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * Lấy danh sách truyện có đánh giá cao
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getTopRatedStories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await specialStoryService.getTopRatedStories(parseInt(limit));
    res.json({
      success: true,
      stories
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * Lấy danh sách truyện được cập nhật gần đây
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRecentStories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await specialStoryService.getRecentStories(parseInt(limit));
    res.json({
      success: true,
      stories
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * Lấy danh sách truyện theo thể loại
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getStoriesByCategory = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await specialStoryService.getStoriesByCategory(req.params.categoryId, parseInt(limit));
    res.json({
      success: true,
      stories
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * Lấy danh sách truyện theo tác giả
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getStoriesByAuthor = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await specialStoryService.getStoriesByAuthor(req.params.authorId, parseInt(limit));
    res.json({
      success: true,
      stories
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * Tìm kiếm truyện theo từ khóa
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.searchStories = async (req, res) => {
  try {
    const { keyword, limit = 10 } = req.query;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: 'Keyword is required'
      });
    }

    const stories = await specialStoryService.searchStories(keyword, parseInt(limit));
    res.json({
      success: true,
      stories
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * Lấy danh sách truyện mới (is_new = true)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getNewStories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const result = await specialStoryService.getNewStories(parseInt(limit));

    // Trả về kết quả trực tiếp từ service mà không bọc thêm một lớp nữa
    res.json(result);
  } catch (err) {
    console.error('Error getting new stories:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
};

/**
 * Lấy danh sách truyện đã hoàn thành (is_full = true)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getFullStories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const result = await specialStoryService.getFullStories(parseInt(limit));

    // Trả về kết quả trực tiếp từ service
    res.json(result);
  } catch (err) {
    console.error('Error getting full stories:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
};

/**
 * Lấy danh sách truyện đề xuất
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getSuggestedStories = async (req, res) => {
  try {
    const options = {
      storyId: req.query.storyId,
      page: req.query.page || 1,
      limit: req.query.limit || 6,
      sortBy: req.query.sortBy || 'views',
      sortOrder: req.query.sortOrder || 'desc',
      categoryFilter: req.query.categoryFilter
    };

    const result = await specialStoryService.getSuggestedStories(options);

    // Trả về kết quả trực tiếp từ service mà không bọc thêm một lớp nữa
    res.json({
      success: true,
      items: result.items,
      total: result.total,
      totalPages: result.totalPages,
      currentPage: result.currentPage
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * Lấy danh sách thể loại cho dropdown
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getCategoriesList = async (req, res) => {
  try {
    console.log('[API] Lấy danh sách thể loại');

    const categories = await Category.find({ status: true })
      .select('_id name slug')
      .sort({ name: 1 });

    return res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * Lấy danh sách tác giả cho dropdown
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAuthorsList = async (req, res) => {
  try {
    console.log('[API] Lấy danh sách tác giả');

    const authors = await Author.find({ status: true })
      .select('_id name slug')
      .sort({ name: 1 });

    return res.json({
      success: true,
      authors
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * Bật/tắt trạng thái truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] Toggle trạng thái truyện - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }

    // Kiểm tra truyện tồn tại
    const story = await Story.findById(id);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    // Đảo ngược trạng thái
    story.status = !story.status;
    await story.save();

    return res.json({
      success: true,
      message: `Truyện đã được ${story.status ? 'kích hoạt' : 'vô hiệu hóa'}`,
      status: story.status
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * Bật/tắt cờ (is_hot, is_new, is_full, v.v.)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.toggleFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { flag } = req.body;
    console.log(`[API] Toggle cờ truyện - id: ${id}, flag: ${flag}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }

    // Kiểm tra flag hợp lệ
    const validFlags = ['is_hot', 'is_new', 'is_full', 'show_ads', 'hot_day', 'hot_month', 'hot_all_time'];
    if (!flag || !validFlags.includes(flag)) {
      return res.status(400).json({
        success: false,
        message: 'Flag không hợp lệ'
      });
    }

    // Kiểm tra truyện tồn tại
    const story = await Story.findById(id);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    // Đảo ngược giá trị flag
    story[flag] = !story[flag];
    await story.save();

    return res.json({
      success: true,
      message: `Đã ${story[flag] ? 'bật' : 'tắt'} ${flag} cho truyện`,
      [flag]: story[flag]
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * Lấy danh sách truyện có nhiều bình luận nhất
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getMostCommented = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    console.log(`[API] Getting most commented stories - limit: ${limit}, page: ${page}`);

    const result = await storyService.getMostCommentedStories({
      limit: parseInt(limit),
      page: parseInt(page)
    });

    res.json({
      success: true,
      stories: result.stories,
      pagination: result.pagination,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
      currentPage: result.pagination.currentPage,
      limit: result.pagination.limit
    });
  } catch (err) {
    console.error('[API] Error getting most commented stories:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};