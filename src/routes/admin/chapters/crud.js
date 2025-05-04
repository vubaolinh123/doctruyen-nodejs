const express = require('express');
const router = express.Router();
const Chapter = require('../../../models/Chapter');
const Story = require('../../../models/Story');
const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * @route GET /api/admin/chapters
 * @desc Lấy danh sách chapter cho admin (có phân trang và lọc)
 * @access Private (Admin)
 */
router.get('/', async (req, res) => {
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

    console.log(`[Admin API] Lấy danh sách chapter - page: ${page}, limit: ${limit}, search: ${search}, count_by_story: ${count_by_story}`);

    // Nếu yêu cầu đếm số lượng chapter theo truyện
    if (count_by_story === 'true') {
      console.log('[Admin API] Đếm số lượng chapter theo truyện');

      // Đếm số lượng chapter theo story_id
      const chapterCounts = await Chapter.aggregate([
        { $group: { _id: "$story_id", count: { $sum: 1 } } }
      ]);

      // Chuyển đổi ObjectId thành string để dễ so sánh
      const formattedChapterCounts = chapterCounts.map(item => {
        const storyIdStr = item._id ? item._id.toString() : '';
        console.log(`[Admin API] Story ID: ${storyIdStr}, Count: ${item.count}`);
        return {
          _id: storyIdStr,
          count: item.count
        };
      });

      // Lấy chapter mới nhất của mỗi truyện
      const latestChapters = await Chapter.aggregate([
        {
          $sort: { chapter: -1 } // Sắp xếp theo số chapter giảm dần
        },
        {
          $group: {
            _id: "$story_id",
            story_id: { $first: "$story_id" },
            chapter: { $first: "$chapter" },
            name: { $first: "$name" },
            slug: { $first: "$slug" },
            createdAt: { $first: "$createdAt" }
          }
        }
      ]);

      // Chuyển đổi ObjectId thành string để dễ so sánh
      const formattedLatestChapters = latestChapters.map(item => {
        const storyIdStr = item.story_id ? item.story_id.toString() : '';
        const itemIdStr = item._id ? item._id.toString() : '';
        console.log(`[Admin API] Latest chapter - Story ID: ${storyIdStr}, Chapter: ${item.chapter}`);
        return {
          ...item,
          _id: itemIdStr,
          story_id: storyIdStr
        };
      });

      return res.json({
        success: true,
        chapterCounts: formattedChapterCounts,
        latestChapters: formattedLatestChapters
      });
    }

    // Xây dựng query
    const query = {};

    // Tìm kiếm theo tên hoặc slug
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    // Lọc theo trạng thái
    if (status !== undefined) {
      query.status = status === 'true';
    }

    // Lọc theo cờ is_new
    if (is_new !== undefined) {
      query.is_new = is_new === 'true';
    }

    // Lọc theo cờ audio_show
    if (audio_show !== undefined) {
      query.audio_show = audio_show === 'true';
    }

    // Lọc theo cờ show_ads
    if (show_ads !== undefined) {
      query.show_ads = show_ads === 'true';
    }

    // Lọc theo truyện
    if (story_id) {
      try {
        if (mongoose.Types.ObjectId.isValid(story_id)) {
          query.story_id = new mongoose.Types.ObjectId(story_id);
          console.log(`[Admin API] Filtering by story: ${story_id}`);
        } else {
          console.log(`[Admin API] Invalid story ID: ${story_id}`);
          return res.status(400).json({
            success: false,
            message: 'ID truyện không hợp lệ',
            error: `Invalid story ID: ${story_id}`
          });
        }
      } catch (error) {
        console.error(`[Admin API] Error converting story_id to ObjectId: ${error.message}`);
        return res.status(400).json({
          success: false,
          message: 'Lỗi khi xử lý ID truyện',
          error: error.message
        });
      }
    }

    // Thực hiện truy vấn với phân trang
    const chapters = await Chapter.find(query)
      .populate('story_id', 'name slug')
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Đếm tổng số chapter thỏa mãn điều kiện
    const total = await Chapter.countDocuments(query);

    return res.json({
      success: true,
      chapters,
      pagination: {
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

/**
 * @route GET /api/admin/chapters/:id
 * @desc Lấy thông tin chi tiết một chapter
 * @access Private (Admin)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Admin API] Lấy thông tin chapter - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID chapter không hợp lệ'
      });
    }

    const chapter = await Chapter.findById(id)
      .populate('story_id', 'name slug');

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
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

/**
 * @route POST /api/admin/chapters
 * @desc Tạo chapter mới
 * @access Private (Admin)
 */
router.post('/', async (req, res) => {
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

    console.log(`[Admin API] Tạo chapter mới - name: ${name}`);

    // Kiểm tra story_id
    if (!story_id) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện là bắt buộc'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(story_id)) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }

    // Kiểm tra truyện tồn tại
    const story = await Story.findById(story_id);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    // Kiểm tra số chapter
    if (chapter === undefined || chapter === null) {
      return res.status(400).json({
        success: false,
        message: 'Số chapter là bắt buộc'
      });
    }

    // Kiểm tra tên chapter
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tên chapter là bắt buộc'
      });
    }

    // Tạo slug nếu không có
    let chapterSlug = slug;
    if (!chapterSlug) {
      chapterSlug = slugify(`chuong-${chapter}-${name}`, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
    }

    // Kiểm tra slug đã tồn tại chưa
    const existingChapter = await Chapter.findOne({
      story_id,
      slug: chapterSlug
    });

    if (existingChapter) {
      return res.status(400).json({
        success: false,
        message: 'Slug đã tồn tại, vui lòng chọn tên khác'
      });
    }

    // Tạo chapter mới
    const newChapter = new Chapter({
      kho_truyen_chapter_id: 0, // Mặc định là 0
      story_id,
      chapter: Number(chapter),
      name,
      slug: chapterSlug,
      content: content || '',
      audio: audio || '',
      audio_show: Boolean(audio_show),
      show_ads: Boolean(show_ads),
      link_ref: link_ref || '',
      pass_code: pass_code || '',
      is_new: Boolean(is_new),
      status: status !== undefined ? Boolean(status) : false
    });

    await newChapter.save();

    return res.status(201).json({
      success: true,
      message: 'Tạo chapter thành công',
      chapter: newChapter
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/admin/chapters/:id
 * @desc Cập nhật thông tin chapter
 * @access Private (Admin)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
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

    console.log(`[Admin API] Cập nhật chapter - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID chapter không hợp lệ'
      });
    }

    // Kiểm tra chapter tồn tại
    const chapterExists = await Chapter.findById(id);
    if (!chapterExists) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chapter'
      });
    }

    // Kiểm tra story_id nếu được cung cấp
    if (story_id) {
      if (!mongoose.Types.ObjectId.isValid(story_id)) {
        return res.status(400).json({
          success: false,
          message: 'ID truyện không hợp lệ'
        });
      }

      // Kiểm tra truyện tồn tại
      const story = await Story.findById(story_id);
      if (!story) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy truyện'
        });
      }
    }

    // Kiểm tra slug nếu được cung cấp
    let chapterSlug = slug;
    if (name && chapter && !chapterSlug) {
      chapterSlug = slugify(`chuong-${chapter}-${name}`, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
    }

    if (chapterSlug && chapterSlug !== chapterExists.slug) {
      const existingChapter = await Chapter.findOne({
        story_id: story_id || chapterExists.story_id,
        slug: chapterSlug,
        _id: { $ne: id }
      });

      if (existingChapter) {
        return res.status(400).json({
          success: false,
          message: 'Slug đã tồn tại, vui lòng chọn tên khác'
        });
      }
    }

    // Cập nhật thông tin chapter
    const updateData = {
      ...(story_id && { story_id }),
      ...(chapter !== undefined && { chapter: Number(chapter) }),
      ...(name && { name }),
      ...(chapterSlug && { slug: chapterSlug }),
      ...(content !== undefined && { content }),
      ...(audio !== undefined && { audio }),
      ...(audio_show !== undefined && { audio_show: Boolean(audio_show) }),
      ...(show_ads !== undefined && { show_ads: Boolean(show_ads) }),
      ...(link_ref !== undefined && { link_ref }),
      ...(pass_code !== undefined && { pass_code }),
      ...(is_new !== undefined && { is_new: Boolean(is_new) }),
      ...(status !== undefined && { status: Boolean(status) })
    };

    const updatedChapter = await Chapter.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('story_id', 'name slug');

    return res.json({
      success: true,
      message: 'Cập nhật chapter thành công',
      chapter: updatedChapter
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/admin/chapters/:id
 * @desc Xóa chapter
 * @access Private (Admin)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Admin API] Xóa chapter - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID chapter không hợp lệ'
      });
    }

    // Kiểm tra chapter tồn tại
    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chapter'
      });
    }

    // Xóa chapter
    await Chapter.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Xóa chapter thành công'
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/admin/chapters/:id/toggle-status
 * @desc Bật/tắt trạng thái chapter
 * @access Private (Admin)
 */
router.put('/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Admin API] Toggle trạng thái chapter - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID chapter không hợp lệ'
      });
    }

    // Kiểm tra chapter tồn tại
    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chapter'
      });
    }

    // Đảo ngược trạng thái
    chapter.status = !chapter.status;
    await chapter.save();

    return res.json({
      success: true,
      message: `Chapter đã được ${chapter.status ? 'kích hoạt' : 'vô hiệu hóa'}`,
      status: chapter.status
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/admin/chapters/:id/toggle-flag
 * @desc Bật/tắt cờ (is_new, audio_show, show_ads)
 * @access Private (Admin)
 */
router.put('/:id/toggle-flag', async (req, res) => {
  try {
    const { id } = req.params;
    const { flag } = req.body;
    console.log(`[Admin API] Toggle cờ chapter - id: ${id}, flag: ${flag}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID chapter không hợp lệ'
      });
    }

    // Kiểm tra flag hợp lệ
    const validFlags = ['is_new', 'audio_show', 'show_ads'];
    if (!flag || !validFlags.includes(flag)) {
      return res.status(400).json({
        success: false,
        message: 'Flag không hợp lệ'
      });
    }

    // Kiểm tra chapter tồn tại
    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chapter'
      });
    }

    // Đảo ngược giá trị flag
    chapter[flag] = !chapter[flag];
    await chapter.save();

    return res.json({
      success: true,
      message: `Đã ${chapter[flag] ? 'bật' : 'tắt'} ${flag} cho chapter`,
      [flag]: chapter[flag]
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

module.exports = router;
