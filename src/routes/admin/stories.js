const express = require('express');
const router = express.Router();
const Story = require('../../models/Story');
const Chapter = require('../../models/Chapter');
const Category = require('../../models/Category');
const Author = require('../../models/Author');
const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * @route GET /api/admin/stories
 * @desc Lấy danh sách truyện cho admin (có phân trang và lọc)
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
      is_hot,
      is_new,
      is_full,
      category,
      author
    } = req.query;

    console.log(`[Admin API] Lấy danh sách truyện - page: ${page}, limit: ${limit}, search: ${search}`);

    // Xây dựng query
    const query = {};

    // Tìm kiếm theo tên hoặc mô tả
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { desc: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    // Lọc theo trạng thái
    if (status !== undefined) {
      query.status = status === 'true';
    }

    // Lọc theo các flag
    if (is_hot !== undefined) {
      query.is_hot = is_hot === 'true';
    }

    if (is_new !== undefined) {
      query.is_new = is_new === 'true';
    }

    if (is_full !== undefined) {
      query.is_full = is_full === 'true';
    }

    // Lọc theo thể loại
    if (category) {
      try {
        if (mongoose.Types.ObjectId.isValid(category)) {
          query.categories = new mongoose.Types.ObjectId(category);
          console.log(`[Admin API] Filtering by category: ${category}`);
        } else {
          console.log(`[Admin API] Invalid category ID: ${category}`);
          return res.status(400).json({
            success: false,
            message: 'ID thể loại không hợp lệ',
            error: `Invalid category ID: ${category}`
          });
        }
      } catch (error) {
        console.error(`[Admin API] Error converting category to ObjectId: ${error.message}`);
        return res.status(400).json({
          success: false,
          message: 'Lỗi khi xử lý ID thể loại',
          error: error.message
        });
      }
    }

    // Lọc theo tác giả
    if (author) {
      try {
        if (mongoose.Types.ObjectId.isValid(author)) {
          query.author_id = new mongoose.Types.ObjectId(author);
          console.log(`[Admin API] Filtering by author: ${author}`);
        } else {
          console.log(`[Admin API] Invalid author ID: ${author}`);
          return res.status(400).json({
            success: false,
            message: 'ID tác giả không hợp lệ',
            error: `Invalid author ID: ${author}`
          });
        }
      } catch (error) {
        console.error(`[Admin API] Error converting author to ObjectId: ${error.message}`);
        return res.status(400).json({
          success: false,
          message: 'Lỗi khi xử lý ID tác giả',
          error: error.message
        });
      }
    }

    // Thực hiện truy vấn với phân trang
    const stories = await Story.find(query)
      .populate('categories', 'name slug')
      .populate('author_id', 'name slug')
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Đếm tổng số truyện thỏa mãn điều kiện
    const total = await Story.countDocuments(query);

    // Lấy thông tin số chapter cho mỗi truyện
    const storiesWithChapterCount = await Promise.all(
      stories.map(async (story) => {
        const chapterCount = await Chapter.countDocuments({ story_id: story._id });
        const storyObj = story.toObject();
        storyObj.chapter_count = chapterCount;
        return storyObj;
      })
    );

    return res.json({
      success: true,
      stories: storiesWithChapterCount,
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
 * @route GET /api/admin/stories/:id
 * @desc Lấy thông tin chi tiết một truyện
 * @access Private (Admin)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Admin API] Lấy thông tin truyện - id: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }

    const story = await Story.findById(id)
      .populate('categories', 'name slug')
      .populate('author_id', 'name slug');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    // Lấy số lượng chapter
    const chapterCount = await Chapter.countDocuments({ story_id: id });

    // Lấy chapter mới nhất
    const latestChapter = await Chapter.findOne({ story_id: id })
      .sort({ chapter: -1 })
      .select('chapter name createdAt');

    const storyData = story.toObject();
    storyData.chapter_count = chapterCount;
    storyData.latest_chapter = latestChapter;

    return res.json({
      success: true,
      story: storyData
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
 * @route POST /api/admin/stories
 * @desc Tạo truyện mới
 * @access Private (Admin)
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      slug,
      image,
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

    console.log(`[Admin API] Tạo truyện mới - name: ${name}`);

    // Kiểm tra tên truyện
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tên truyện là bắt buộc'
      });
    }

    // Tạo slug nếu không có
    let storySlug = slug;
    if (!storySlug) {
      storySlug = slugify(name, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
    }

    // Kiểm tra slug đã tồn tại chưa
    const existingStory = await Story.findOne({ slug: storySlug });
    if (existingStory) {
      return res.status(400).json({
        success: false,
        message: 'Slug đã tồn tại, vui lòng chọn tên khác'
      });
    }

    // Tạo truyện mới
    const newStory = new Story({
      name,
      slug: storySlug,
      image: image || '',
      desc: desc || '',
      author_id: author_id || [],
      categories: categories || [],
      stars: 0,
      count_star: 0,
      views: 0,
      is_full: Boolean(is_full),
      is_hot: Boolean(is_hot),
      is_new: Boolean(is_new),
      show_ads: Boolean(show_ads),
      hot_day: Boolean(hot_day),
      hot_month: Boolean(hot_month),
      hot_all_time: Boolean(hot_all_time),
      status: status !== undefined ? Boolean(status) : true
    });

    await newStory.save();

    return res.status(201).json({
      success: true,
      message: 'Tạo truyện thành công',
      story: newStory
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
 * @route PUT /api/admin/stories/:id
 * @desc Cập nhật thông tin truyện
 * @access Private (Admin)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      slug,
      image,
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

    console.log(`[Admin API] Cập nhật truyện - id: ${id}`);

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

    // Kiểm tra slug nếu được cung cấp
    let storySlug = slug;
    if (name && !storySlug) {
      storySlug = slugify(name, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
    }

    if (storySlug && storySlug !== story.slug) {
      const existingStory = await Story.findOne({ slug: storySlug, _id: { $ne: id } });
      if (existingStory) {
        return res.status(400).json({
          success: false,
          message: 'Slug đã tồn tại, vui lòng chọn tên khác'
        });
      }
    }

    // Cập nhật thông tin truyện
    const updateData = {
      ...(name && { name }),
      ...(storySlug && { slug: storySlug }),
      ...(image !== undefined && { image }),
      ...(desc !== undefined && { desc }),
      ...(author_id && { author_id }),
      ...(categories && { categories }),
      ...(is_full !== undefined && { is_full: Boolean(is_full) }),
      ...(is_hot !== undefined && { is_hot: Boolean(is_hot) }),
      ...(is_new !== undefined && { is_new: Boolean(is_new) }),
      ...(show_ads !== undefined && { show_ads: Boolean(show_ads) }),
      ...(hot_day !== undefined && { hot_day: Boolean(hot_day) }),
      ...(hot_month !== undefined && { hot_month: Boolean(hot_month) }),
      ...(hot_all_time !== undefined && { hot_all_time: Boolean(hot_all_time) }),
      ...(status !== undefined && { status: Boolean(status) })
    };

    const updatedStory = await Story.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('categories', 'name slug')
     .populate('author_id', 'name slug');

    return res.json({
      success: true,
      message: 'Cập nhật truyện thành công',
      story: updatedStory
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
 * @route DELETE /api/admin/stories/:id
 * @desc Xóa truyện
 * @access Private (Admin)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Admin API] Xóa truyện - id: ${id}`);

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

    // Kiểm tra xem có chapter nào không
    const chapterCount = await Chapter.countDocuments({ story_id: id });
    if (chapterCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa truyện vì có ${chapterCount} chapter liên quan. Vui lòng xóa các chapter trước.`
      });
    }

    // Xóa truyện
    await Story.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Xóa truyện thành công'
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
 * @route GET /api/admin/stories/categories
 * @desc Lấy danh sách thể loại cho dropdown
 * @access Private (Admin)
 */
router.get('/categories/list', async (req, res) => {
  try {
    console.log('[Admin API] Lấy danh sách thể loại');

    const categories = await Category.find({ status: true })
      .select('_id name slug')
      .sort({ name: 1 });

    return res.json({
      success: true,
      categories
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
 * @route GET /api/admin/stories/authors
 * @desc Lấy danh sách tác giả cho dropdown
 * @access Private (Admin)
 */
router.get('/authors/list', async (req, res) => {
  try {
    console.log('[Admin API] Lấy danh sách tác giả');

    const authors = await Author.find({ status: true })
      .select('_id name slug')
      .sort({ name: 1 });

    return res.json({
      success: true,
      authors
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
 * @route PUT /api/admin/stories/:id/toggle-status
 * @desc Bật/tắt trạng thái truyện
 * @access Private (Admin)
 */
router.put('/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Admin API] Toggle trạng thái truyện - id: ${id}`);

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
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/admin/stories/:id/toggle-flag
 * @desc Bật/tắt cờ (is_hot, is_new, is_full, v.v.)
 * @access Private (Admin)
 */
router.put('/:id/toggle-flag', async (req, res) => {
  try {
    const { id } = req.params;
    const { flag } = req.body;
    console.log(`[Admin API] Toggle cờ truyện - id: ${id}, flag: ${flag}`);

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
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

module.exports = router;
