const specialStoryService = require('../../services/story/specialStoryService');

/**
 * Lấy danh sách truyện hot
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getHotStories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await specialStoryService.getHotStories(parseInt(limit));
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      return res.status(400).json({ error: 'Keyword is required' });
    }

    const stories = await specialStoryService.searchStories(keyword, parseInt(limit));
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 