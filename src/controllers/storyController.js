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

    // Filter by single category if provided
    if (filters.category) {
      // In ra log để debug
      console.log("Filter by single category:", filters.category);

      // Kiểm tra xem giá trị là ID hay slug
      if (mongoose.Types.ObjectId.isValid(filters.category)) {
        // Sử dụng trực tiếp ID
        query.categories = filters.category;
        console.log("Category is ObjectId, using directly:", filters.category);
      } else {
        // Nếu là slug, cần tìm category trước
        const Category = require('../models/Category');
        console.log("Category is slug, searching for:", filters.category);

        const category = await Category.findOne({ slug: filters.category });
        console.log("Category search result:", category ? { _id: category._id, name: category.name, slug: category.slug } : null);

        if (category) {
          // Sử dụng ID của category
          query.categories = category._id;
          console.log("Found category, using ID:", category._id);
        } else {
          console.log("Category not found with slug:", filters.category);
        }
      }
    }

    // Filter by multiple categories if provided
    if (filters.categories) {
      // Handle both array and single value
      const categoryValues = Array.isArray(filters.categories) ? filters.categories : [filters.categories];

      // Xử lý và làm sạch các giá trị
      const cleanCategoryValues = categoryValues
        .map(val => val.trim())
        .filter(val => val); // Lọc bỏ các giá trị rỗng

      if (cleanCategoryValues.length > 0) {
        // In ra log để debug
        console.log("Filter by multiple categories (cleaned):", cleanCategoryValues);
        console.log("Number of categories:", cleanCategoryValues.length);

        // Luôn xử lý như slug, vì frontend luôn gửi slug
        const Category = require('../models/Category');

        // In ra log để debug
        console.log("Tìm thể loại theo slug:", cleanCategoryValues);

        try {
          // Tìm tất cả thể loại theo slug
          const categories = await Category.find({ slug: { $in: cleanCategoryValues } });

          // In ra log để debug
          console.log("Kết quả tìm thể loại:", categories.map(cat => ({ _id: cat._id, name: cat.name, slug: cat.slug })));
          console.log("Số lượng thể loại tìm thấy:", categories.length);

          if (categories.length > 0) {
            // Kiểm tra xem đã tìm thấy đủ số lượng thể loại chưa
            if (categories.length !== cleanCategoryValues.length) {
              console.log("Cảnh báo: Không tìm thấy đủ thể loại. Yêu cầu:", cleanCategoryValues.length, "Tìm thấy:", categories.length);

              // Log các slug không tìm thấy
              const foundSlugs = categories.map(cat => cat.slug);
              const missingSlugs = cleanCategoryValues.filter(slug => !foundSlugs.includes(slug));
              console.log("Các slug không tìm thấy:", missingSlugs);
            }

            // Sử dụng $all để đảm bảo truyện phải thuộc về TẤT CẢ các thể loại đã chọn
            const categoryIds = categories.map(cat => cat._id);

            // Thay đổi cách truy vấn để tìm truyện có TẤT CẢ các thể loại
            if (categoryIds.length === 1) {
              // Nếu chỉ có 1 thể loại, sử dụng truy vấn đơn giản
              query.categories = categoryIds[0];
              console.log("Using simple query with category ID:", categoryIds[0]);
            } else {
              // Nếu có nhiều thể loại, sử dụng $and với $in cho từng thể loại
              // Cách này đảm bảo truyện phải chứa TẤT CẢ các thể loại đã chọn
              const andConditions = categoryIds.map(catId => ({
                categories: catId
              }));

              // Thêm điều kiện $and vào query
              query.$and = andConditions;

              console.log("Using $and query:", JSON.stringify(query.$and));
            }

            // In ra log để debug
            console.log("Category IDs being searched:", categories.map(cat => cat._id));
          } else {
            console.log("Không tìm thấy thể loại nào với slug:", cleanCategoryValues);
          }
        } catch (error) {
          console.error("Lỗi khi tìm thể loại:", error);
        }
      }
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

    // Filter by hot_day, hot_month, hot_all_time if provided
    if (filters.hot_day !== undefined) {
      query.hot_day = filters.hot_day === 'true';
    }

    if (filters.hot_month !== undefined) {
      query.hot_month = filters.hot_month === 'true';
    }

    if (filters.hot_all_time !== undefined) {
      query.hot_all_time = filters.hot_all_time === 'true';
    }

    // Log để debug
    console.log("Backend API - Chapter filter params:", {
      chapter_count: filters.chapter_count,
      chapter_count_op: filters.chapter_count_op,
      has_chapters: filters.has_chapters,
      chapter_count_type: typeof filters.chapter_count,
      chapter_count_op_type: typeof filters.chapter_count_op,
      has_chapters_type: typeof filters.has_chapters
    });

    // Kiểm tra xem có lọc theo số lượng chapter không
    // Chuyển đổi kiểu dữ liệu của filters.chapter_count từ string sang number nếu cần
    if (filters.chapter_count && filters.chapter_count !== '') {
      filters.chapter_count = parseInt(filters.chapter_count);
    }

    const hasChapterFilter = (filters.chapter_count !== undefined && filters.chapter_count !== '') ||
                            (filters.chapter_count_op !== undefined && filters.chapter_count_op !== '') ||
                            (filters.has_chapters !== undefined && filters.has_chapters !== '');

    // Kiểm tra xem có sắp xếp theo số lượng chapter không
    const sortByChapterCount = filters.sort_by === 'chapter_count';

    // Xác định trường sắp xếp và thứ tự
    const sortField = filters.sort_by || 'updatedAt';
    const sortOrder = filters.sort_order === 'asc' ? 1 : -1;

    console.log("Sorting by:", sortField, "Order:", sortOrder);
    console.log("Has chapter filter:", hasChapterFilter);
    console.log("Sort by chapter count:", sortByChapterCount);

    // Kiểm tra xem có yêu cầu thêm thông tin chapter không
    const includeChapterCount = filters.include_chapter_count === 'true' || hasChapterFilter || sortByChapterCount;
    const includeLatestChapter = filters.include_latest_chapter === 'true';

    // Tạo sortOptions dựa trên trường sắp xếp
    let sortOptions = {};

    // Nếu sắp xếp theo số lượng chapter, sử dụng trường chapter_count
    if (sortField === 'chapter_count') {
      sortOptions.chapter_count = sortOrder;
    } else {
      sortOptions[sortField] = sortOrder;
    }

    // Nếu không có lọc theo số lượng chapter và không sắp xếp theo số lượng chapter, thực hiện truy vấn bình thường
    if (!hasChapterFilter && !sortByChapterCount) {
      const items = await Story.find(query)
        .populate('authors', 'name slug')
        .populate('categories', 'name slug')
        .sort(sortOptions)
        .skip((page - 1) * parseInt(limit))
        .limit(parseInt(limit));

      // Count total
      const total = await Story.countDocuments(query);

      // Nếu có yêu cầu thêm thông tin chapter, xử lý thêm
      if (includeChapterCount || includeLatestChapter) {
        const Chapter = require('../models/Chapter');

        // Tối ưu: Lấy số lượng chapter cho tất cả truyện trong một lần truy vấn
        let chapterCounts = {};
        let latestChapters = {};

        if (includeChapterCount) {
          // Lấy số lượng chapter cho tất cả truyện
          const storyIds = items.map(story => story._id);
          const chapterAggregation = await Chapter.aggregate([
            { $match: { story_id: { $in: storyIds } } },
            { $group: { _id: "$story_id", count: { $sum: 1 } } }
          ]);

          // Chuyển đổi kết quả thành object để dễ truy cập
          chapterCounts = chapterAggregation.reduce((acc, item) => {
            acc[item._id.toString()] = item.count;
            return acc;
          }, {});

          console.log("Chapter counts for stories:", chapterCounts);
        }

        if (includeLatestChapter) {
          // Lấy chapter mới nhất cho tất cả truyện
          const storyIds = items.map(story => story._id);
          const latestChapterPromises = storyIds.map(storyId =>
            Chapter.findOne({ story_id: storyId })
              .sort({ chapter: -1 })
              .select('chapter name createdAt')
          );

          const latestChapterResults = await Promise.all(latestChapterPromises);

          // Chuyển đổi kết quả thành object để dễ truy cập
          latestChapters = storyIds.reduce((acc, storyId, index) => {
            acc[storyId.toString()] = latestChapterResults[index];
            return acc;
          }, {});
        }

        // Thêm thông tin chapter vào mỗi truyện
        const storiesWithChapterInfo = items.map(story => {
          const storyObj = story.toObject();
          const storyId = story._id.toString();

          // Thêm số lượng chapter
          if (includeChapterCount) {
            storyObj.chapter_count = chapterCounts[storyId] || 0;
          }

          // Thêm chapter mới nhất
          if (includeLatestChapter) {
            storyObj.latest_chapter = latestChapters[storyId] || null;
          }

          return storyObj;
        });

        // Trả về kết quả với thông tin chapter
        res.json({
          items: storiesWithChapterInfo,
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
          currentPage: parseInt(page)
        });
      } else {
        // Trả về kết quả không có thông tin chapter
        res.json({
          items,
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
          currentPage: parseInt(page)
        });
      }
    } else {
      // Nếu có lọc theo số lượng chapter hoặc sắp xếp theo số lượng chapter, cần xử lý thêm
      const Chapter = require('../models/Chapter');

      // Tối ưu: Sử dụng aggregation để lấy số lượng chapter cho tất cả truyện
      const chapterAggregation = await Chapter.aggregate([
        { $group: { _id: "$story_id", count: { $sum: 1 } } }
      ]);

      console.log("Total stories with chapters:", chapterAggregation.length);

      // Xử lý filter theo số lượng chapter
      if (hasChapterFilter) {
        // Nếu có lọc theo has_chapters
        if (filters.has_chapters !== undefined) {
          const hasChaptersBool = filters.has_chapters === 'true';
          console.log("Filter by has_chapters:", hasChaptersBool);

          if (hasChaptersBool) {
            // Lọc truyện có chapter (chapter_count > 0)
            query.chapter_count = { $gt: 0 };
          } else {
            // Lọc truyện không có chapter (chapter_count = 0)
            query.chapter_count = 0;
          }
        }

        // Nếu có lọc theo số lượng chapter cụ thể
        if (filters.chapter_count !== undefined && filters.chapter_count !== '' &&
            filters.chapter_count_op !== undefined && filters.chapter_count_op !== '') {
          // Đảm bảo chapter_count là số
          const chapterCountNum = parseInt(filters.chapter_count);
          const chapterCountOp = filters.chapter_count_op;

          console.log("Filter by chapter count:", chapterCountOp, chapterCountNum);

          // Thêm điều kiện lọc theo số lượng chapter vào query
          switch (chapterCountOp) {
            case 'eq': // Bằng
              query.chapter_count = chapterCountNum;
              break;
            case 'gt': // Lớn hơn
              query.chapter_count = { $gt: chapterCountNum };
              break;
            case 'lt': // Nhỏ hơn
              query.chapter_count = { $lt: chapterCountNum };
              break;
            case 'gte': // Lớn hơn hoặc bằng
              query.chapter_count = { $gte: chapterCountNum };
              break;
            case 'lte': // Nhỏ hơn hoặc bằng
              query.chapter_count = { $lte: chapterCountNum };
              break;
            default:
              query.chapter_count = chapterCountNum;
          }

          console.log("Query after adding chapter_count filter:", JSON.stringify(query));
        }
      }

      // Lấy truyện theo query đã được cập nhật và sắp xếp
      let items = await Story.find(query)
        .populate('authors', 'name slug')
        .populate('categories', 'name slug')
        .sort(sortOptions);

      // Count total
      const total = items.length;

      // Không cần thêm thông tin số lượng chapter vào mỗi truyện
      // vì đã có trường chapter_count trong model Story

      // Phân trang
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedItems = items.slice(startIndex, endIndex);

      // Thêm thông tin chapter mới nhất nếu cần
      if (includeLatestChapter) {
        const storyIds = paginatedItems.map(story => story._id);
        const latestChapterPromises = storyIds.map(storyId =>
          Chapter.findOne({ story_id: storyId })
            .sort({ chapter: -1 })
            .select('chapter name createdAt')
        );

        const latestChapterResults = await Promise.all(latestChapterPromises);

        // Thêm chapter mới nhất vào mỗi truyện
        paginatedItems.forEach((story, index) => {
          story.latest_chapter = latestChapterResults[index];
        });
      }

      // Trả về kết quả
      res.json({
        items: paginatedItems,
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page)
      });
    }
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
      banner,
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
      banner: banner || '',
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
    if (req.body.banner !== undefined) updateData.banner = req.body.banner;
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

// Tăng lượt view cho truyện theo slug
exports.incrementViews = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug is required' });
    }

    // Tìm truyện theo slug
    const story = await Story.findOne({ slug, status: true });

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    // Tăng lượt view lên 1
    story.views += 1;
    await story.save();

    return res.status(200).json({
      success: true,
      message: 'View count incremented successfully',
      views: story.views
    });
  } catch (err) {
    console.error('Error incrementing views:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Get new stories (is_new = true)
exports.getNewStories = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Tìm truyện có is_new = true và status = true
    const stories = await Story.find({
      is_new: true,
      status: true
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('author_id', 'name slug')
      .populate('categories', 'name slug');

    // Lấy chapter mới nhất cho mỗi truyện
    const Chapter = require('../models/Chapter');
    const storiesWithChapterInfo = await Promise.all(
      stories.map(async (story) => {
        const storyObj = story.toObject();

        // Lấy chapter mới nhất
        const latestChapter = await Chapter.findOne({ story_id: story._id })
          .sort({ chapter: -1 })
          .select('chapter name createdAt');
        storyObj.latest_chapter = latestChapter;

        return storyObj;
      })
    );

    res.json({
      success: true,
      stories: storiesWithChapterInfo
    });
  } catch (err) {
    console.error('Error getting new stories:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
};

// Get suggested stories based on categories and views
exports.getSuggestedStories = async (req, res) => {
  try {
    const {
      storyId,
      page = 1,
      limit = 6,
      sortBy = 'views', // Mặc định sắp xếp theo lượt xem
      sortOrder = 'desc', // Mặc định sắp xếp giảm dần
      categoryFilter // Lọc theo thể loại cụ thể (tùy chọn)
    } = req.query;

    // Import mongoose
    const mongoose = require('mongoose');

    // Tạo query cơ bản
    let query = { status: true };
    let categoryIds = [];

    // Nếu có storyId, lấy thông tin truyện và thể loại của nó
    if (storyId) {
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
      categoryIds = currentStory.categories;

      // Loại trừ truyện hiện tại khỏi kết quả
      query._id = { $ne: storyId };

      // Nếu không có thể loại nào, trả về danh sách trống
      if (!categoryIds || categoryIds.length === 0) {
        return res.json({
          items: [],
          total: 0,
          totalPages: 0,
          currentPage: parseInt(page)
        });
      }

      // Thêm điều kiện lọc theo thể loại của truyện hiện tại
      query.categories = { $in: categoryIds };
    }
    // Nếu không có storyId nhưng có categoryFilter, lọc theo categoryFilter
    else if (categoryFilter) {
      // Kiểm tra categoryFilter có phải là ObjectId hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(categoryFilter)) {
        return res.status(400).json({ error: 'Invalid category ID' });
      }

      // Thêm điều kiện lọc theo thể loại được chỉ định
      query.categories = { $in: [categoryFilter] };
    }

    // Xác định cách sắp xếp
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Lấy danh sách truyện đề xuất
    const suggestedStories = await Story.find(query)
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('author_id', 'name slug')
      .populate('categories', 'name slug');

    // Đếm tổng số truyện đề xuất
    let total = 0;
    if (storyId) {
      total = await Story.countDocuments(query);
    } else if (categoryFilter) {
      total = await Story.countDocuments(query);
    } else {
      total = 0;
    }

    // Lấy chapter mới nhất cho mỗi truyện
    const Chapter = require('../models/Chapter');
    const storiesWithChapterInfo = await Promise.all(
      suggestedStories.map(async (story) => {
        const storyObj = story.toObject();

        // Lấy chapter mới nhất
        const latestChapter = await Chapter.findOne({ story_id: story._id })
          .sort({ chapter: -1 })
          .select('chapter name createdAt');
        storyObj.latest_chapter = latestChapter;

        return storyObj;
      })
    );

    res.json({
      items: storiesWithChapterInfo,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};