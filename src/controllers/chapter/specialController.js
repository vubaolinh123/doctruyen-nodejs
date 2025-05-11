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
    const slug = req.params.slug;
    const result = await chapterService.getChapterBySlug(slug);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

/**
 * Lấy thông tin chi tiết của một chapter theo slug của chapter và slug của truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getChapterByStoryAndChapterSlug = async (req, res) => {
  try {
    const storySlug = req.params.storySlug;
    const chapterSlug = req.params.chapterSlug;
    const result = await chapterService.getChapterByStoryAndChapterSlug(storySlug, chapterSlug);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

/**
 * Lấy danh sách chapter theo slug của truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getChaptersByStorySlug = async (req, res) => {
  try {
    const storySlug = req.params.storySlug;
    const chapters = await chapterService.getChaptersByStorySlug(storySlug);
    res.json({
      success: true,
      chapters
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.getByStoryId = async (req, res) => {
  try {
    const storyId = req.params.storyId;
    const item = await chapterService.findByStoryId(storyId);
    if (!item) return res.status(404).json({ error: 'No chapters found for this story' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Lấy danh sách chapter có phân trang và lọc (Admin)
 */
exports.getChapters = async (req, res) => {
  try {
    const {
      page,
      limit,
      sort,
      search,
      status,
      is_new,
      story_id,
      audio_show,
      show_ads,
      count_by_story
    } = req.query;

    console.log(`[API] Lấy danh sách chapter - page: ${page}, limit: ${limit}, search: ${search}, count_by_story: ${count_by_story}`);

    const result = await chapterService.getChapters({
      page,
      limit,
      sort,
      search,
      status,
      is_new,
      story_id,
      audio_show,
      show_ads,
      count_by_story
    });

    // Nếu yêu cầu đếm số lượng chapter theo truyện
    if (count_by_story === 'true') {
      return res.json({
        success: true,
        chapterCounts: result.chapterCounts,
        latestChapters: result.latestChapters
      });
    }

    return res.json({
      success: true,
      chapters: result.chapters,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * Bật/tắt trạng thái chapter
 */
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] Toggle trạng thái chapter - id: ${id}`);

    const result = await chapterService.toggleStatus(id);

    return res.json({
      success: true,
      message: `Chapter đã được ${result.status ? 'kích hoạt' : 'vô hiệu hóa'}`,
      status: result.status
    });
  } catch (error) {
    console.error('[API] Error:', error);

    if (error.message === 'ID chapter không hợp lệ') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Không tìm thấy chapter') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * Bật/tắt cờ (is_new, audio_show, show_ads)
 */
exports.toggleFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { flag } = req.body;
    console.log(`[API] Toggle cờ chapter - id: ${id}, flag: ${flag}`);

    const result = await chapterService.toggleFlag(id, flag);

    return res.json({
      success: true,
      message: `Đã ${result.value ? 'bật' : 'tắt'} ${flag} cho chapter`,
      [flag]: result.value
    });
  } catch (error) {
    console.error('[API] Error:', error);

    if (error.message === 'ID chapter không hợp lệ' || error.message === 'Flag không hợp lệ') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Không tìm thấy chapter') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * Lấy danh sách truyện cho dropdown
 */
exports.getStoriesForDropdown = async (req, res) => {
  try {
    console.log('[API] Lấy danh sách truyện cho dropdown');

    const stories = await chapterService.getStoriesForDropdown();

    return res.json({
      success: true,
      stories
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