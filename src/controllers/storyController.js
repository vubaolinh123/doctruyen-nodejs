const Story = require('../models/Story');
const mongoose = require('mongoose');
const slugify = require('slugify');

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, ...filters } = req.query;
    const query = {};

    // Filter by status if provided
    if (filters.status !== undefined) {
      query.status = filters.status === 'true';
    }

    // Filter by categories if provided
    if (filters.category) {
      query.categories = filters.category;
    }

    // Filter by author if provided
    if (filters.author) {
      query.author_id = filters.author;
    }

    // Filter by name if provided
    if (filters.name) {
      query.name = { $regex: filters.name, $options: 'i' };
    }

    // Filter by slug if provided
    if (filters.slug) {
      query.slug = filters.slug;
    }

    // Filter by flags if provided
    if (filters.is_hot !== undefined) {
      query.is_hot = filters.is_hot === 'true';
    }

    if (filters.is_new !== undefined) {
      query.is_new = filters.is_new === 'true';
    }

    if (filters.is_full !== undefined) {
      query.is_full = filters.is_full === 'true';
    }

    const items = await Story.find(query)
      .populate('authors', 'name slug')
      .populate('categories', 'name slug')
      .sort({ createdAt: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Count total
    const total = await Story.countDocuments(query);

    res.json({
      items,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const item = await Story.findById(req.params.id)
      .populate('authors', 'name slug')
      .populate('categories', 'name slug');

    if (!item) return res.status(404).json({ error: 'Not found' });

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const item = await Story.findBySlug(req.params.slug)
      .populate('author_id', 'name slug')
      .populate('categories', 'name slug');

    if (!item) return res.status(404).json({ error: 'Not found' });

    // Lấy số lượng chapter
    const Chapter = require('../models/Chapter');
    const chapterCount = await Chapter.countDocuments({ story_id: item._id });

    // Lấy chapter mới nhất
    const latestChapter = await Chapter.findOne({ story_id: item._id })
      .sort({ chapter: -1 })
      .select('chapter name createdAt');

    // Chuyển đổi thành object để có thể thêm trường
    const storyData = item.toObject();
    storyData.chapter_count = chapterCount;
    storyData.latest_chapter = latestChapter;

    res.json(storyData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      name,
      slug,
      image,
      desc,
      author_id,
      categories,
      stars,
      count_star,
      views,
      is_full,
      is_hot,
      is_new,
      show_ads,
      hot_day,
      hot_month,
      hot_all_time,
      status
    } = req.body;

    // Check if name is provided
    if (!name) {
      return res.status(400).json({ error: 'Story name is required' });
    }

    // Prepare data
    const storyData = {
      name,
      image: image || '',
      desc: desc || '',
      author_id: author_id || [],
      categories: categories || [],
      stars: stars || 0,
      count_star: count_star || 0,
      views: views || 0,
      is_full: Boolean(is_full),
      is_hot: Boolean(is_hot),
      is_new: Boolean(is_new),
      show_ads: Boolean(show_ads),
      hot_day: Boolean(hot_day),
      hot_month: Boolean(hot_month),
      hot_all_time: Boolean(hot_all_time),
      status: status !== undefined ? Boolean(status) : true
    };

    // Add slug if provided, otherwise will be auto-generated
    if (slug) {
      storyData.slug = slug;
    }

    const item = new Story(storyData);
    await item.save();

    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const updateData = {};

    // Only update fields that are present in request
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.slug !== undefined) updateData.slug = req.body.slug;
    if (req.body.image !== undefined) updateData.image = req.body.image;
    if (req.body.desc !== undefined) updateData.desc = req.body.desc;
    if (req.body.author_id !== undefined) updateData.author_id = req.body.author_id;
    if (req.body.categories !== undefined) updateData.categories = req.body.categories;
    if (req.body.stars !== undefined) updateData.stars = req.body.stars;
    if (req.body.count_star !== undefined) updateData.count_star = req.body.count_star;
    if (req.body.views !== undefined) updateData.views = req.body.views;
    if (req.body.is_full !== undefined) updateData.is_full = Boolean(req.body.is_full);
    if (req.body.is_hot !== undefined) updateData.is_hot = Boolean(req.body.is_hot);
    if (req.body.is_new !== undefined) updateData.is_new = Boolean(req.body.is_new);
    if (req.body.show_ads !== undefined) updateData.show_ads = Boolean(req.body.show_ads);
    if (req.body.hot_day !== undefined) updateData.hot_day = Boolean(req.body.hot_day);
    if (req.body.hot_month !== undefined) updateData.hot_month = Boolean(req.body.hot_month);
    if (req.body.hot_all_time !== undefined) updateData.hot_all_time = Boolean(req.body.hot_all_time);
    if (req.body.status !== undefined) updateData.status = Boolean(req.body.status);

    // If name is updated but slug is not provided, regenerate the slug
    if (req.body.name && req.body.slug === undefined) {
      updateData.slug = slugify(req.body.name, {
        lower: true,
        strict: true,
        locale: 'vi'
      });
    }

    const item = await Story.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('authors', 'name slug')
     .populate('categories', 'name slug');

    if (!item) return res.status(404).json({ error: 'Not found' });

    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await Story.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get hot stories
exports.getHotStories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await Story.findHotStories(parseInt(limit))
      .populate('authors', 'name slug')
      .populate('categories', 'name slug');

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get top rated stories
exports.getTopRatedStories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await Story.findTopRatedStories(parseInt(limit))
      .populate('authors', 'name slug')
      .populate('categories', 'name slug');

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get recent stories
exports.getRecentStories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await Story.findRecentlyUpdated(parseInt(limit))
      .populate('authors', 'name slug')
      .populate('categories', 'name slug');

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get stories by category
exports.getStoriesByCategory = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await Story.findByCategory(req.params.categoryId, parseInt(limit))
      .populate('authors', 'name slug')
      .populate('categories', 'name slug');

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get stories by author
exports.getStoriesByAuthor = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stories = await Story.findByAuthor(req.params.authorId, parseInt(limit))
      .populate('authors', 'name slug')
      .populate('categories', 'name slug');

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Search stories
exports.searchStories = async (req, res) => {
  try {
    const { keyword, limit = 10 } = req.query;

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    const stories = await Story.search(keyword, parseInt(limit))
      .populate('authors', 'name slug')
      .populate('categories', 'name slug');

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get suggested stories based on categories and views
exports.getSuggestedStories = async (req, res) => {
  try {
    const { storyId, page = 1, limit = 6 } = req.query;

    if (!storyId) {
      return res.status(400).json({ error: 'Story ID is required' });
    }

    // Import mongoose
    const mongoose = require('mongoose');

    // Kiểm tra storyId có phải là ObjectId hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }

    // Lấy thông tin truyện hiện tại
    const currentStory = await Story.findById(storyId);
    if (!currentStory) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Lấy danh sách thể loại của truyện hiện tại
    const categoryIds = currentStory.categories;

    // Nếu không có thể loại nào, trả về danh sách trống
    if (!categoryIds || categoryIds.length === 0) {
      return res.json({
        items: [],
        total: 0,
        totalPages: 0,
        currentPage: parseInt(page)
      });
    }

    // Lấy danh sách truyện đề xuất
    const suggestedStories = await Story.findSuggestedStories(
      categoryIds,
      storyId,
      parseInt(page),
      parseInt(limit)
    )
      .populate('author_id', 'name slug')
      .populate('categories', 'name slug');

    // Đếm tổng số truyện đề xuất
    const total = await Story.countSuggestedStories(categoryIds, storyId);

    // Lấy số lượng chapter cho mỗi truyện
    const Chapter = require('../models/Chapter');
    const storiesWithChapterCount = await Promise.all(
      suggestedStories.map(async (story) => {
        const storyObj = story.toObject();

        // Đếm số lượng chapter
        const chapterCount = await Chapter.countDocuments({ story_id: story._id });
        storyObj.chapter_count = chapterCount;

        // Lấy chapter mới nhất
        const latestChapter = await Chapter.findOne({ story_id: story._id })
          .sort({ chapter: -1 })
          .select('chapter name createdAt');
        storyObj.latest_chapter = latestChapter;

        return storyObj;
      })
    );

    res.json({
      items: storiesWithChapterCount,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};