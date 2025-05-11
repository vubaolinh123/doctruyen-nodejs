const chapterService = require('../../services/chapter/chapterService');
const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * Lấy tất cả các chapter
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
      is_new,
      story_id,
      audio_show,
      show_ads,
      count_by_story = false
    } = req.query;

    console.log(`[API] Lấy danh sách chapter - page: ${page}, limit: ${limit}, search: ${search}`);

    if (count_by_story === 'true') {
      const result = await chapterService.getChapters({
        page, limit, sort, search, status, is_new, story_id, audio_show, show_ads, count_by_story
      });
      
      return res.json({
        success: true,
        chapterCounts: result.chapterCounts,
        latestChapters: result.latestChapters
      });
    }

    // Gọi service để lấy danh sách chapter
    const result = await chapterService.getChapters({
      page, limit, sort, search, status, is_new, story_id, audio_show, show_ads, count_by_story
    });

    return res.json({
      success: true,
      chapters: result.chapters,
      pagination: result.pagination
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
 * Lấy chapter theo ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] Lấy thông tin chapter - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID chapter không hợp lệ'
      });
    }

    const chapter = await chapterService.getChapterById(id);
    if (!chapter) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy chapter' 
      });
    }

    return res.json({
      success: true,
      chapter
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
 * Tạo chapter mới
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.create = async (req, res) => {
  try {
    const {
      story_id,
      chapter,
      name,
      slug,
      content,
      audio,
      audio_show,
      show_ads,
      link_ref,
      pass_code,
      is_new,
      status
    } = req.body;

    console.log(`[API] Tạo chapter mới - name: ${name}`);

    // Validate input data
    if (!story_id) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện là bắt buộc'
      });
    }

    if (chapter === undefined || chapter === null) {
      return res.status(400).json({
        success: false,
        message: 'Số chapter là bắt buộc'
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tên chapter là bắt buộc'
      });
    }

    // Generate slug if not provided
    const chapterData = {
      ...req.body,
      slug: slug || slugify(`chuong-${chapter}-${name}`, {
        lower: true,
        strict: true,
        locale: 'vi'
      })
    };

    const newChapter = await chapterService.createChapter(chapterData);
    
    return res.status(201).json({
      success: true,
      message: 'Tạo chapter thành công',
      chapter: newChapter
    });
  } catch (err) {
    console.error('[API] Error:', err);
    
    // Handle common errors
    if (err.message.includes('Story not found') || err.message.includes('Không tìm thấy truyện')) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }
    
    if (err.message.includes('Invalid story_id') || err.message.includes('ID truyện không hợp lệ')) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Lỗi khi tạo chapter',
      error: err.message
    });
  }
};

/**
 * Cập nhật chapter
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] Cập nhật chapter - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID chapter không hợp lệ'
      });
    }

    // Kiểm tra chapter tồn tại
    const chapterExists = await chapterService.getChapterById(id);
    if (!chapterExists) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chapter'
      });
    }

    // Tự động tạo slug nếu có name và chapter nhưng không có slug
    let { slug, name, chapter } = req.body;
    if (name && chapter && !slug) {
      slug = slugify(`chuong-${chapter}-${name}`, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
      req.body.slug = slug;
    }

    const updatedChapter = await chapterService.updateChapter(id, req.body);

    return res.json({
      success: true,
      message: 'Cập nhật chapter thành công',
      chapter: updatedChapter
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(400).json({
      success: false,
      message: 'Lỗi khi cập nhật chapter',
      error: err.message
    });
  }
};

/**
 * Xóa chapter
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] Xóa chapter - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID chapter không hợp lệ'
      });
    }

    // Kiểm tra chapter tồn tại
    const chapter = await chapterService.getChapterById(id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chapter'
      });
    }

    // Xóa chapter
    await chapterService.deleteChapter(id);

    return res.json({
      success: true,
      message: 'Xóa chapter thành công'
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