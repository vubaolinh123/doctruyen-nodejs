const storyService = require('../../services/story/storyService');
const mongoose = require('mongoose');
const slugify = require('slugify');

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
      is_hot,
      is_new,
      is_full,
      category,
      categories,
      author,
      hasChapters,
      chapterCount,
      chapterCountOp = 'eq'
    } = req.query;

    console.log(`[API] Lấy danh sách truyện - page: ${page}, limit: ${limit}, search: ${search}, categories: ${categories}`);

    // Xây dựng options
    const options = {
      page,
      limit,
      sort,
      search,
      status,
      is_hot,
      is_new,
      is_full,
      category,
      categories,
      author,
      hasChapters,
      chapterCount,
      chapterCountOp
    };

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
      status
    } = req.body;

    console.log(`[API] Tạo truyện mới - name: ${name}`);

    // Validate input data
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tên truyện là bắt buộc'
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
    console.log(`[API] Cập nhật truyện - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
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

    const updatedStory = await storyService.updateStory(id, req.body);

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