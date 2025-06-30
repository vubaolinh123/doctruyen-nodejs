const chapterService = require('../../services/chapter/chapterService');

/**
 * Lấy danh sách chapter theo story ID với tối ưu hóa
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getChaptersByStory = async (req, res) => {
  try {
    const storyId = req.params.storyId;

    // Lấy query parameters
    const {
      page,
      limit,
      search = '',
      sort = 'chapter',
      excludeContent = 'false' // Tham số mới để loại bỏ content
    } = req.query;

    console.log(`[API] Lấy danh sách chapter cho story ID: ${storyId}, excludeContent: ${excludeContent}`);

    // Kiểm tra storyId có tồn tại không
    if (!storyId) {
      console.error('[API] Thiếu ID truyện');
      return res.status(400).json({
        success: false,
        message: 'Thiếu ID truyện'
      });
    }

    try {
      let result;

      // Nếu có pagination parameters, sử dụng pagination
      if (page || limit) {
        result = await chapterService.getChaptersByStoryWithPagination(storyId, {
          page: parseInt(page || 1),
          limit: parseInt(limit || 100),
          search: search.toString(),
          sort,
          excludeContent: excludeContent === 'true'
        });

        console.log(`[API] Tìm thấy ${result.chapters.length} chapter (trang ${page}/${result.pagination.totalPages}) cho story ID: ${storyId}`);

        // Trả về dữ liệu với pagination metadata
        return res.json({
          success: true,
          chapters: result.chapters,
          pagination: {
            currentPage: result.pagination.currentPage,
            totalPages: result.pagination.totalPages,
            totalItems: result.pagination.totalItems,
            limit: result.pagination.limit,
            hasNext: result.pagination.hasNext,
            hasPrevious: result.pagination.hasPrevious
          }
        });
      } else {
        // Không có pagination, lấy tất cả chapters
        result = await chapterService.getChaptersByStory(storyId, {
          excludeContent: excludeContent === 'true'
        });

        console.log(`[API] Tìm thấy ${result.chapters.length} chapter cho story ID: ${storyId}`);

        // Trả về dữ liệu dạng array đơn giản (tương thích với frontend hiện tại)
        return res.json(result.chapters);
      }
    } catch (serviceError) {
      console.error(`[API] Lỗi từ service khi lấy danh sách chapter: ${serviceError.message}`);

      // Xử lý các lỗi cụ thể từ service
      if (serviceError.message.includes('ID truyện không hợp lệ')) {
        return res.status(400).json({
          success: false,
          message: 'ID truyện không hợp lệ'
        });
      } else if (serviceError.message.includes('Không tìm thấy truyện')) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy truyện'
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Lỗi khi lấy danh sách chapter',
          error: serviceError.message
        });
      }
    }
  } catch (err) {
    console.error(`[API] Lỗi không xác định khi lấy danh sách chapter theo story ID: ${req.params.storyId}`, err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ',
      error: err.message
    });
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
 * Lấy danh sách chapter theo slug của truyện với access control
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getChaptersByStorySlug = async (req, res) => {
  try {
    const storySlug = req.params.storySlug;

    // Extract pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000; // Default to all chapters for backward compatibility

    // SERVER-SIDE ACCESS CONTROL: Extract user ID from session/token/headers
    const userId = req.user?.id || req.user?._id || req.headers['x-user-id'] || null;

    console.log(`[API] Getting chapters for story: ${storySlug}, user: ${userId || 'anonymous'}, page: ${page}, limit: ${limit}`);

    // FREEMIUM MODEL: Get chapters with access control validation and pagination
    const result = await chapterService.getChaptersByStorySlug(storySlug, userId, {
      page,
      limit
    });

    res.json({
      success: true,
      chapters: result.chapters,
      story: result.story,
      // Add pagination metadata
      totalChapters: result.totalChapters || result.chapters.length,
      totalPages: result.totalPages || Math.ceil((result.totalChapters || result.chapters.length) / limit),
      currentPage: page,
      accessInfo: {
        isAuthenticated: !!userId,
        totalChapters: result.totalChapters || result.chapters.length,
        accessibleChapters: result.chapters.filter(ch => ch.hasAccess).length,
        paidChapters: result.chapters.filter(ch => ch.isPaid).length
      }
    });
  } catch (err) {
    console.error('[API] Error getting chapters with access control:', err);
    res.status(404).json({
      success: false,
      error: err.message
    });
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

/**
 * Lấy số chương tiếp theo của một truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getNextChapterNumber = async (req, res) => {
  try {
    const { storyId } = req.params;
    console.log(`[API] Lấy số chương tiếp theo cho truyện ID: ${storyId}`);

    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }

    const nextChapterNumber = await chapterService.getNextChapterNumber(storyId);

    return res.json({
      success: true,
      nextChapterNumber
    });
  } catch (error) {
    console.error('[API] Error:', error);

    if (error.message.includes('ID truyện không hợp lệ')) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};