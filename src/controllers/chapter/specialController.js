const chapterService = require('../../services/chapter/chapterService');

/**
 * Lấy danh sách chapter theo story ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getChaptersByStory = async (req, res) => {
  try {
    const chapters = await chapterService.getChaptersByStory(req.params.storyId);
    res.json(chapters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Lấy chapter mới nhất theo story ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getLatestChapter = async (req, res) => {
  try {
    const chapter = await chapterService.getLatestChapter(req.params.storyId);
    res.json(chapter);
  } catch (err) {
    if (err.message === 'No chapters found') {
      return res.status(404).json({ error: 'No chapters found' });
    }
    res.status(500).json({ error: err.message });
  }
};

/**
 * Lấy thông tin chi tiết của một chapter theo slug
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getChapterBySlug = async (req, res) => {
  try {
    const result = await chapterService.getChapterBySlug(req.params.slug);
    res.json(result);
  } catch (err) {
    console.error('[API] Error:', err);
    if (err.message === 'Không tìm thấy chapter' || err.message === 'Không tìm thấy truyện của chapter này') {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
};

/**
 * Lấy thông tin chi tiết của một chapter theo slug của chapter và slug của truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getChapterByStoryAndChapterSlug = async (req, res) => {
  try {
    const { storySlug, chapterSlug } = req.params;
    const result = await chapterService.getChapterByStoryAndChapterSlug(storySlug, chapterSlug);
    res.json(result);
  } catch (err) {
    console.error('[API] Error:', err);
    if (err.message === 'Không tìm thấy truyện' || err.message === 'Không tìm thấy chapter') {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
};

/**
 * Lấy danh sách chapter theo slug của truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getChaptersByStorySlug = async (req, res) => {
  try {
    const result = await chapterService.getChaptersByStorySlug(req.params.storySlug);
    res.json(result);
  } catch (err) {
    console.error('[API] Error:', err);
    if (err.message === 'Không tìm thấy truyện') {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
}; 