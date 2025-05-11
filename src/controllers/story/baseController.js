const storyService = require('../../services/story/storyService');

/**
 * Lấy danh sách tất cả truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAll = async (req, res) => {
  try {
    const result = await storyService.getAllStories(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Lấy truyện theo ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getById = async (req, res) => {
  try {
    const item = await storyService.getStoryById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Lấy truyện theo slug
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getBySlug = async (req, res) => {
  try {
    const item = await storyService.getStoryBySlug(req.params.slug);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Tạo truyện mới
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.create = async (req, res) => {
  try {
    const item = await storyService.createStory(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * Cập nhật truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.update = async (req, res) => {
  try {
    const item = await storyService.updateStory(req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * Xóa truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.remove = async (req, res) => {
  try {
    const item = await storyService.deleteStory(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      return res.status(400).json({ success: false, message: 'Slug is required' });
    }

    const result = await storyService.incrementStoryViews(slug);
    return res.status(200).json({
      success: true,
      message: 'View count incremented successfully',
      views: result.views
    });
  } catch (err) {
    console.error('Error incrementing views:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}; 