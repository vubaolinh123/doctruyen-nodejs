const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const Category = require('../../models/category');
const StoryStats = require('../../models/storyStats');
const storyStatsService = require('../storyStats/storyStatsService');
const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * Xây dựng query cho truyện dựa trên các bộ lọc
 * @param {Object} filters - Các tham số lọc
 * @returns {Promise<Object>} - Query đã xây dựng
 */
const buildStoryQuery = async (filters) => {
  let query = {};

  // CRITICAL: For public queries, only show approved and published stories
  // Admin queries can override this behavior
  if (!filters.isAdminQuery) {
    query.approval_status = 'approved';
    query.status = 'published';
  }

  // Filter by status if provided (for admin queries)
  if (filters.status !== undefined && filters.isAdminQuery) {
    // Handle both string and boolean values for backward compatibility
    if (typeof filters.status === 'string') {
      if (filters.status === 'true' || filters.status === 'false') {
        query.status = filters.status === 'true' ? 'published' : 'draft';
      } else {
        query.status = filters.status; // Use string value directly
      }
    } else {
      query.status = Boolean(filters.status) ? 'published' : 'draft';
    }
  }

  // Filter by approval status if provided (for admin queries)
  if (filters.approval_status !== undefined && filters.isAdminQuery) {
    query.approval_status = filters.approval_status;
  }
  // Filter by single category if provided
  if (filters.category) {
    query = await processCategoryFilter(query, filters.category);
  }
  // Filter by multiple categories if provided
  if (filters.categories) {
    query = await processMultipleCategoriesFilter(query, filters.categories);
  }
  // Filter by author if provided
  if (filters.author) {
    query.author_id = filters.author;
  }
  // Filter by name or search if provided
  if (filters.name) {
    query.name = { $regex: filters.name, $options: 'i' };
  } else if (filters.search) {
    // Search in both name and slug fields
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { slug: { $regex: filters.search, $options: 'i' } }
    ];
  }

  // Filter by slug if provided
  if (filters.slug) {
    query.slug = filters.slug;
  }

  // Filter by date range if provided
  if (filters.updated_at_start || filters.updated_at_end) {
    query.updatedAt = {};

    if (filters.updated_at_start) {
      query.updatedAt.$gte = new Date(filters.updated_at_start);
    }

    if (filters.updated_at_end) {
      query.updatedAt.$lte = new Date(filters.updated_at_end);
    }
  }

  // Filter by flags if provided
  processFlagsFilters(query, filters);
  return query;
};

/**
 * Xử lý filter theo một category
 * @param {Object} query - Query đang xây dựng
 * @param {string} categoryValue - Giá trị category cần lọc
 * @returns {Promise<Object>} - Query đã cập nhật
 */
const processCategoryFilter = async (query, categoryValue) => {
  if (mongoose.Types.ObjectId.isValid(categoryValue)) {
    // Sử dụng trực tiếp ID
    query.categories = categoryValue;
  } else {
    try {
      // Nếu là slug, cần tìm category trước
      // Category model is already imported at the top of the file

      // Tìm chính xác slug
      const category = await Category.findOne({ slug: categoryValue });

      if (category) {
        // Sử dụng ID của category
        query.categories = category._id;
      } else {
        // Thử tìm kiếm với regex
        const regexCategory = await Category.findOne({
          slug: new RegExp('^' + categoryValue + '$', 'i')
        });

        if (regexCategory) {
          // Sử dụng ID của category tìm thấy bằng regex
          query.categories = regexCategory._id;
        }
      }
    } catch (error) {
      console.error("processCategoryFilter - Error:", error);
    }
  }

  // Trả về query đã cập nhật
  return query;
};

/**
 * Xử lý filter theo nhiều categories
 * @param {Object} query - Query đang xây dựng
 * @param {string|Array} categoriesValue - Giá trị categories cần lọc
 * @returns {Promise<Object>} - Query đã cập nhật
 */
const processMultipleCategoriesFilter = async (query, categoriesValue) => {
  // Kiểm tra nếu categoriesValue là undefined hoặc null
  if (!categoriesValue) {
    return query;
  }

  // Handle both array and single value
  const categoryValues = Array.isArray(categoriesValue) ? categoriesValue : [categoriesValue];

  // Xử lý và làm sạch các giá trị
  const cleanCategoryValues = categoryValues
    .map(val => typeof val === 'string' ? val.trim() : val)
    .filter(val => val); // Lọc bỏ các giá trị rỗng

  if (cleanCategoryValues.length > 0) {
    try {
      // Luôn xử lý như slug, vì frontend luôn gửi slug
      // Category model is already imported at the top of the file

      // Tìm tất cả thể loại theo slug - CHÍNH XÁC slug, không phải regex
      const categories = await Category.find({ slug: { $in: cleanCategoryValues } });

      if (categories.length > 0) {
        // Lấy ID của các thể loại
        const categoryIds = categories.map(cat => cat._id);

        // Sử dụng $in để lấy truyện thuộc về MỘT TRONG các thể loại đã chọn
        query.categories = { $in: categoryIds };
      } else {
        // Thử tìm kiếm với regex để xem có vấn đề gì với slug không
        const regexPromises = cleanCategoryValues.map(slug =>
          Category.findOne({ slug: new RegExp('^' + slug + '$', 'i') })
        );

        const regexResults = await Promise.all(regexPromises);
        const foundCategories = regexResults.filter(Boolean);

        if (foundCategories.length > 0) {
          // Lấy ID của các thể loại tìm thấy bằng regex
          const categoryIds = foundCategories.map(cat => cat._id);

          // Sử dụng $in để lấy truyện thuộc về MỘT TRONG các thể loại đã chọn
          query.categories = { $in: categoryIds };
        }
      }
    } catch (error) {
      console.error("Error processing categories filter:", error);
    }
  }

  // Trả về query đã cập nhật
  return query;
};

/**
 * Lấy danh sách truyện với các bộ lọc
 * @param {Object} filters - Các tham số lọc
 * @returns {Promise<Object>} - Kết quả trả về
 */
const getAllStories = async (filters) => {
  const { page = 1, limit = 10, isAdminRequest = false, ...otherFilters } = filters;

  // Pass admin flag to query builder
  otherFilters.isAdminQuery = isAdminRequest;

  // Xử lý trực tiếp categories nếu có
  if (filters.categories) {
    // Đảm bảo otherFilters.categories tồn tại
    otherFilters.categories = filters.categories;
  }
  // Xử lý trực tiếp các tham số liên quan đến chapter
  if (filters.chapter_count !== undefined && filters.chapter_count !== '') {
    otherFilters.chapter_count = filters.chapter_count;
  }

  if (filters.chapter_count_op !== undefined && filters.chapter_count_op !== '') {
    otherFilters.chapter_count_op = filters.chapter_count_op;
  } else if (otherFilters.chapter_count !== undefined) {
    // Nếu có chapter_count nhưng không có chapter_count_op, đặt mặc định là 'eq'
    otherFilters.chapter_count_op = 'eq';
  }
  if (filters.has_chapters !== undefined && filters.has_chapters !== '') {
    otherFilters.has_chapters = filters.has_chapters;
  }

  // Xây dựng query dựa trên các bộ lọc
  const query = await buildStoryQuery(otherFilters);

  // Xác định trường sắp xếp và thứ tự
  const sortField = otherFilters.sort_by || 'updatedAt';
  const sortOrder = otherFilters.sort_order === 'asc' ? 1 : -1;
  const sortOptions = {};
  // Xử lý các trường sắp xếp đặc biệt
  switch (sortField) {
    case 'chapter_count':
      // Sắp xếp theo số lượng chapter
      sortOptions.chapter_count = sortOrder;
      break;
    case 'name':
      // Sắp xếp theo tên truyện
      sortOptions.name = sortOrder;
      break;
    case 'views':
      // Sắp xếp theo lượt xem
      sortOptions.views = sortOrder;
      break;
    case 'createdAt':
      // Sắp xếp theo ngày tạo
      sortOptions.createdAt = sortOrder;
      break;
    case 'updatedAt':
      // Sắp xếp theo ngày cập nhật
      sortOptions.updatedAt = sortOrder;
      break;
    default:
      // Mặc định sắp xếp theo ngày cập nhật
      sortOptions.updatedAt = sortOrder;
  }
  // Kiểm tra xem có lọc theo số lượng chapter không
  const hasChapterFilter = checkHasChapterFilter(otherFilters);
  const sortByChapterCount = otherFilters.sort_by === 'chapter_count';
  const sortByViews = otherFilters.sort_by === 'views';

  // Kiểm tra xem có yêu cầu thêm thông tin chapter không
  const includeChapterCount = otherFilters.include_chapter_count === 'true' || hasChapterFilter || sortByChapterCount;
  const includeLatestChapter = otherFilters.include_latest_chapter === 'true';

  // Nếu sắp xếp theo views, sử dụng aggregation pipeline
  if (sortByViews) {
    // Truyền string sort_order thay vì số
    return await getStoriesSortedByViews(query, otherFilters.sort_order, page, limit, includeChapterCount, includeLatestChapter);
  }

  // Nếu không có lọc theo số lượng chapter và không sắp xếp theo số lượng chapter, thực hiện truy vấn bình thường
  if (!hasChapterFilter && !sortByChapterCount) {
    return await getStoriesWithoutChapterFilters(query, sortOptions, page, limit, includeChapterCount, includeLatestChapter);
  } else {
    return await getStoriesWithChapterFilters(query, sortOptions, page, limit, includeLatestChapter, hasChapterFilter, otherFilters);
  }
};



/**
 * Xử lý các bộ lọc theo flags
 * @param {Object} query - Query đang xây dựng
 * @param {Object} filters - Các tham số lọc flags
 */
const processFlagsFilters = (query, filters) => {

  // Filter by flags
  if (filters.is_hot !== undefined) {
    // Handle both string and boolean values
    if (typeof filters.is_hot === 'string') {
      query.is_hot = filters.is_hot === 'true';
    } else {
      query.is_hot = Boolean(filters.is_hot);
    }
  }

  if (filters.is_new !== undefined) {
    // Handle both string and boolean values
    if (typeof filters.is_new === 'string') {
      query.is_new = filters.is_new === 'true';
    } else {
      query.is_new = Boolean(filters.is_new);
    }
  }

  if (filters.is_full !== undefined) {
    // Handle both string and boolean values
    if (typeof filters.is_full === 'string') {
      query.is_full = filters.is_full === 'true';
    } else {
      query.is_full = Boolean(filters.is_full);
    }
  }

  // Filter by hot_day, hot_month, hot_all_time
  if (filters.hot_day !== undefined) {
    query.hot_day = filters.hot_day === 'true';
  }

  if (filters.hot_month !== undefined) {
    query.hot_month = filters.hot_month === 'true';
  }

  if (filters.hot_all_time !== undefined) {
    query.hot_all_time = filters.hot_all_time === 'true';
  }

};

/**
 * Kiểm tra xem có bộ lọc liên quan đến chapter không
 * @param {Object} filters - Các tham số lọc
 * @returns {boolean} - Có bộ lọc chapter không
 */
const checkHasChapterFilter = (filters) => {
  // Kiểm tra xem các tham số chapter có tồn tại không
  const hasChapterCount = filters.chapter_count !== undefined && filters.chapter_count !== '';
  const hasChapterCountOp = filters.chapter_count_op !== undefined && filters.chapter_count_op !== '';
  const hasHasChapters = filters.has_chapters !== undefined && filters.has_chapters !== '';


  // Chuyển đổi kiểu dữ liệu của filters.chapter_count từ string sang number nếu cần
  if (hasChapterCount) {
    filters.chapter_count = parseInt(filters.chapter_count);
  }

  // Trả về true nếu có ít nhất một tham số chapter
  // Đảm bảo rằng nếu có chapter_count thì cũng phải có chapter_count_op
  const result = (hasChapterCount && hasChapterCountOp) || hasHasChapters;
  return result;
};

/**
 * Lấy danh sách truyện được sắp xếp theo views từ storyStats
 * @param {Object} query - Query để tìm kiếm
 * @param {string} sortOrder - Thứ tự sắp xếp ('asc' hoặc 'desc')
 * @param {number} page - Trang hiện tại
 * @param {number} limit - Số lượng kết quả trên một trang
 * @param {boolean} includeChapterCount - Có bao gồm số lượng chapter không
 * @param {boolean} includeLatestChapter - Có bao gồm chapter mới nhất không
 * @returns {Promise<Object>} - Kết quả trả về
 */
const getStoriesSortedByViews = async (query, sortOrder, page, limit, includeChapterCount, includeLatestChapter) => {
  try {
    console.log(`[getStoriesSortedByViews] sortOrder received: ${sortOrder}, type: ${typeof sortOrder}`);

    // Tạo aggregation pipeline để join với storyStats và sắp xếp theo views
    const pipeline = [
      // Match stories theo query
      { $match: query },

      // Lookup để join với storyStats
      {
        $lookup: {
          from: 'storystats',
          localField: '_id',
          foreignField: 'story_id',
          as: 'stats'
        }
      },

      // Tính tổng tất cả thống kê từ storyStats
      {
        $addFields: {
          totalViews: { $sum: '$stats.views' },
          totalUniqueViews: { $sum: '$stats.unique_views' },
          totalRatingsCount: { $sum: '$stats.ratings_count' },
          totalRatingsSum: { $sum: '$stats.ratings_sum' },
          totalCommentsCount: { $sum: '$stats.comments_count' },
          totalBookmarksCount: { $sum: '$stats.bookmarks_count' },
          totalSharesCount: { $sum: '$stats.shares_count' }
        }
      },

      // Sắp xếp theo totalViews
      { $sort: { totalViews: sortOrder === 'asc' ? 1 : -1 } },

      // Lookup để populate authors
      {
        $lookup: {
          from: 'authors',
          localField: 'author_id',
          foreignField: '_id',
          as: 'authors',
          pipeline: [
            { $project: { name: 1, slug: 1 } }
          ]
        }
      },

      // Lookup để populate categories
      {
        $lookup: {
          from: 'categories',
          localField: 'categories',
          foreignField: '_id',
          as: 'categories',
          pipeline: [
            { $project: { name: 1, slug: 1 } }
          ]
        }
      },

      // Project để đặt giá trị mặc định cho thống kê và giữ lại các trường cần thiết
      {
        $project: {
          // Thống kê từ storyStats
          views: { $ifNull: ['$totalViews', 0] },
          unique_views: { $ifNull: ['$totalUniqueViews', 0] },
          ratings_count: { $ifNull: ['$totalRatingsCount', 0] },
          ratings_sum: { $ifNull: ['$totalRatingsSum', 0] },
          comments_count: { $ifNull: ['$totalCommentsCount', 0] },
          bookmarks_count: { $ifNull: ['$totalBookmarksCount', 0] },
          shares_count: { $ifNull: ['$totalSharesCount', 0] },
          // Các trường cơ bản của story
          _id: 1,
          name: 1,
          slug: 1,
          desc: 1,
          image: 1,
          banner: 1,
          status: 1,
          author_id: 1,
          categories: 1,
          authors: 1,
          is_hot: 1,
          is_new: 1,
          is_full: 1,
          hot_day: 1,
          hot_month: 1,
          hot_all_time: 1,
          show_ads: 1,
          chapter_count: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ];

    // Đếm tổng số documents
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Story.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Thêm pagination
    pipeline.push(
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    // Debug: Log sort direction
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    console.log(`[getStoriesSortedByViews] Sort direction: ${sortDirection} (${sortOrder})`);

    // Thực hiện aggregation
    const items = await Story.aggregate(pipeline);

    // Thêm thông tin chapter nếu cần
    let finalItems = items;
    if (includeChapterCount || includeLatestChapter) {
      finalItems = await addChapterInfoToStories(items, includeChapterCount, includeLatestChapter);
    }

    return {
      items: finalItems,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    };
  } catch (error) {
    console.error('Error in getStoriesSortedByViews:', error);
    // Fallback to normal query without views sorting
    return await getStoriesWithoutChapterFilters(query, { updatedAt: -1 }, page, limit, includeChapterCount, includeLatestChapter);
  }
};

/**
 * Thêm thông tin chapter vào danh sách stories
 * @param {Array} stories - Danh sách stories
 * @param {boolean} includeChapterCount - Có bao gồm số lượng chapter không
 * @param {boolean} includeLatestChapter - Có bao gồm chapter mới nhất không
 * @returns {Promise<Array>} - Danh sách stories với thông tin chapter
 */
const addChapterInfoToStories = async (stories, includeChapterCount, includeLatestChapter) => {
  if (!stories || stories.length === 0) {
    return stories;
  }

  const storyIds = stories.map(story => story._id);
  let chapterCounts = {};
  let latestChapters = {};

  if (includeChapterCount) {
    // Lấy số lượng chapter cho tất cả truyện
    const chapterAggregation = await Chapter.aggregate([
      { $match: { story_id: { $in: storyIds } } },
      { $group: { _id: "$story_id", count: { $sum: 1 } } }
    ]);

    // Chuyển đổi kết quả thành object để dễ truy cập
    chapterCounts = chapterAggregation.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});
  }

  if (includeLatestChapter) {
    // Lấy chapter mới nhất cho tất cả truyện
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
  return stories.map(story => {
    const storyId = story._id.toString();

    // Thêm số lượng chapter
    if (includeChapterCount) {
      story.chapter_count = chapterCounts[storyId] || 0;
    }

    // Thêm chapter mới nhất
    if (includeLatestChapter) {
      story.latest_chapter = latestChapters[storyId] || null;
    }

    return story;
  });
};

/**
 * Lấy danh sách truyện không có filter về chapter
 * @param {Object} query - Query để tìm kiếm
 * @param {Object} sortOptions - Tùy chọn sắp xếp
 * @param {number} page - Trang hiện tại
 * @param {number} limit - Số lượng kết quả trên một trang
 * @param {boolean} includeChapterCount - Có bao gồm số lượng chapter không
 * @param {boolean} includeLatestChapter - Có bao gồm chapter mới nhất không
 * @returns {Promise<Object>} - Kết quả trả về
 */
const getStoriesWithoutChapterFilters = async (query, sortOptions, page, limit, includeChapterCount, includeLatestChapter) => {
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

    // Thêm view counts từ storyStats
    const storiesWithViews = await addViewCountsToStories(storiesWithChapterInfo);

    // Trả về kết quả với thông tin chapter và views
    return {
      items: storiesWithViews,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    };
  } else {
    // Thêm view counts từ storyStats cho trường hợp không có chapter info
    const storiesWithViews = await addViewCountsToStories(items);

    // Trả về kết quả với view counts
    return {
      items: storiesWithViews,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    };
  }
};

/**
 * Lấy danh sách truyện có filter về chapter
 * @param {Object} query - Query để tìm kiếm
 * @param {Object} sortOptions - Tùy chọn sắp xếp
 * @param {number} page - Trang hiện tại
 * @param {number} limit - Số lượng kết quả trên một trang
 * @param {boolean} includeLatestChapter - Có bao gồm chapter mới nhất không
 * @param {boolean} hasChapterFilter - Có bộ lọc chapter không
 * @param {Object} filters - Các tham số lọc
 * @returns {Promise<Object>} - Kết quả trả về
 */
const getStoriesWithChapterFilters = async (query, sortOptions, page, limit, includeLatestChapter, hasChapterFilter, filters) => {
  // Nếu có lọc theo số lượng chapter hoặc sắp xếp theo số lượng chapter, cần xử lý thêm
  // Xử lý filter theo số lượng chapter
  if (hasChapterFilter) {
    // Xử lý filter theo số lượng chapter
    const hasChapterCount = filters.chapter_count !== undefined && filters.chapter_count !== '';
    const hasChapterCountOp = filters.chapter_count_op !== undefined && filters.chapter_count_op !== '';

    if (hasChapterCount && hasChapterCountOp) {
      // Đảm bảo chapter_count là số
      const chapterCountNum = parseInt(filters.chapter_count);
      const chapterCountOp = filters.chapter_count_op;


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
    }

    // Nếu có lọc theo has_chapters
    if (filters.has_chapters !== undefined && filters.has_chapters !== '') {
      // Handle both string and boolean values
      let hasChaptersBool;
      if (typeof filters.has_chapters === 'string') {
        hasChaptersBool = filters.has_chapters === 'true';
      } else {
        hasChaptersBool = Boolean(filters.has_chapters);
      }

      if (hasChaptersBool) {
        // Lọc truyện có chapter (chapter_count > 0)
        if (!query.chapter_count) {
          query.chapter_count = { $gt: 0 };
        }
      } else {
        // Lọc truyện không có chapter (chapter_count = 0)
        query.chapter_count = 0;
      }
    }

  }

  // Lấy truyện theo query đã được cập nhật và sắp xếp
  let items = await Story.find(query)
    .populate('authors', 'name slug')
    .populate('categories', 'name slug')
    .sort(sortOptions);


  // Count total
  const total = items.length;

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

  // Thêm view counts từ storyStats
  const storiesWithViews = await addViewCountsToStories(paginatedItems);

  // Trả về kết quả
  return {
    items: storiesWithViews,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page)
  };
};

/**
 * Xử lý các bộ lọc theo số lượng chapter
 * @param {Object} query - Query đang xây dựng
 * @param {Object} filters - Các tham số lọc
 */
const processChapterCountFilters = (query, filters) => {

  // Nếu có lọc theo has_chapters
  if (filters.has_chapters !== undefined && filters.has_chapters !== '') {
    // Handle both string and boolean values
    let hasChaptersBool;
    if (typeof filters.has_chapters === 'string') {
      hasChaptersBool = filters.has_chapters === 'true';
    } else {
      hasChaptersBool = Boolean(filters.has_chapters);
    }

    if (hasChaptersBool) {
      // Lọc truyện có chapter (chapter_count > 0)
      query.chapter_count = { $gt: 0 };
    } else {
      // Lọc truyện không có chapter (chapter_count = 0)
      query.chapter_count = 0;
    }
  }

  // Nếu có lọc theo số lượng chapter cụ thể
  const hasChapterCount = filters.chapter_count !== undefined && filters.chapter_count !== '';
  const hasChapterCountOp = filters.chapter_count_op !== undefined && filters.chapter_count_op !== '';

  if (hasChapterCount && hasChapterCountOp) {
    // Đảm bảo chapter_count là số
    const chapterCountNum = parseInt(filters.chapter_count);
    const chapterCountOp = filters.chapter_count_op;


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
  } else if (hasChapterCount) {
    // Nếu chỉ có chapter_count mà không có operator, mặc định là bằng
    const chapterCountNum = parseInt(filters.chapter_count);
    query.chapter_count = chapterCountNum;
  }

};

/**
 * Lấy truyện theo ID
 * @param {string} id - ID của truyện
 * @returns {Promise<Object>} - Truyện tìm thấy với thống kê
 */
const getStoryById = async (id) => {
  const story = await Story.findById(id)
    .populate({
      path: 'authors',
      select: 'name slug userId',
      populate: {
        path: 'userId',
        select: 'name email avatar',
        model: 'User'
      }
    })
    .populate('categories', 'name slug');

  if (!story) {
    return null;
  }

  // Thêm thống kê từ storyStats
  const storiesWithStats = await addViewCountsToStories([story]);
  const storyWithStats = storiesWithStats[0];

  // Convert to plain object to modify
  const storyObj = storyWithStats.toObject ? storyWithStats.toObject() : storyWithStats;

  // Remove redundant author_id field for cleaner API response
  delete storyObj.author_id;

  return storyObj;
};

/**
 * Lấy truyện theo slug
 * @param {string} slug - Slug của truyện
 * @returns {Promise<Object>} - Truyện tìm thấy với thông tin bổ sung
 */
const getStoryBySlug = async (slug) => {
  const item = await Story.findBySlug(slug)
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');

  if (!item) return null;

  // Lấy số lượng chapter
  const chapterCount = await Chapter.countDocuments({ story_id: item._id });

  // Lấy chapter mới nhất
  const latestChapter = await Chapter.findOne({ story_id: item._id })
    .sort({ chapter: -1 })
    .select('chapter name createdAt');

  // Chuyển đổi thành object để có thể thêm trường
  const storyData = item.toObject();
  storyData.chapter_count = chapterCount;
  storyData.latest_chapter = latestChapter;

  // Thêm thống kê từ storyStats sử dụng function chung
  const storiesWithStats = await addViewCountsToStories([storyData]);
  const finalStoryData = storiesWithStats[0];

  // Thêm thông tin thống kê chi tiết nếu cần (cho tương thích với frontend)
  try {
    const allStats = await storyStatsService.getAllStats(item._id);
    finalStoryData.stats = {
      views: {
        total: finalStoryData.views,
        byTimeRange: allStats.viewsByTimeRange,
        daily: allStats.dailyStats.views
      },
      ratings: {
        count: finalStoryData.ratings_count,
        sum: finalStoryData.ratings_sum,
        average: finalStoryData.ratings_count > 0 ? finalStoryData.ratings_sum / finalStoryData.ratings_count : 0,
        daily: {
          count: allStats.dailyStats.ratings_count,
          sum: allStats.dailyStats.ratings_sum
        }
      }
    };
  } catch (error) {
    console.error(`Error getting detailed stats for story ${item._id}:`, error);
    // Nếu có lỗi, tạo stats object với giá trị từ aggregation hoặc mặc định
    finalStoryData.stats = {
      views: {
        total: finalStoryData.views,
        byTimeRange: { day: 0, week: 0, month: 0, year: 0, all: finalStoryData.views },
        daily: 0
      },
      ratings: {
        count: finalStoryData.ratings_count,
        sum: finalStoryData.ratings_sum,
        average: finalStoryData.ratings_count > 0 ? finalStoryData.ratings_sum / finalStoryData.ratings_count : 0,
        daily: { count: 0, sum: 0 }
      }
    };
  }

  return finalStoryData;
};

/**
 * Tạo truyện mới
 * @param {Object} storyData - Dữ liệu truyện cần tạo
 * @returns {Promise<Object>} - Truyện đã tạo
 */
const createStory = async (storyData) => {
  // Check if name is provided
  if (!storyData.name) {
    throw new Error('Story name is required');
  }

  // Prepare data
  const newStoryData = {
    name: storyData.name,
    image: storyData.image || '',
    banner: storyData.banner || '',
    desc: storyData.desc || '',
    author_id: storyData.author_id || [],
    categories: storyData.categories || [],
    stars: storyData.stars || 0,
    count_star: storyData.count_star || 0,
    is_full: Boolean(storyData.is_full),
    is_hot: Boolean(storyData.is_hot),
    is_new: Boolean(storyData.is_new),
    show_ads: Boolean(storyData.show_ads),
    hot_day: Boolean(storyData.hot_day),
    hot_month: Boolean(storyData.hot_month),
    hot_all_time: Boolean(storyData.hot_all_time),
    status: storyData.status !== undefined ? Boolean(storyData.status) : true
  };

  // Add slug if provided, otherwise will be auto-generated
  if (storyData.slug) {
    newStoryData.slug = storyData.slug;
  }

  // Add paid content fields
  if (storyData.isPaid !== undefined) {
    newStoryData.isPaid = Boolean(storyData.isPaid);
  }
  if (storyData.price !== undefined) {
    newStoryData.price = Number(storyData.price) || 0;
  }

  const item = new Story(newStoryData);
  return await item.save();
};

/**
 * Cập nhật truyện
 * @param {string} id - ID của truyện
 * @param {Object} updateData - Dữ liệu cần cập nhật
 * @returns {Promise<Object>} - Truyện sau khi cập nhật
 */
const updateStory = async (id, updateData) => {
  const dataToUpdate = {};

  // Only update fields that are present in request
  if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
  if (updateData.slug !== undefined) dataToUpdate.slug = updateData.slug;
  if (updateData.image !== undefined) dataToUpdate.image = updateData.image;
  if (updateData.banner !== undefined) dataToUpdate.banner = updateData.banner;
  if (updateData.desc !== undefined) dataToUpdate.desc = updateData.desc;
  if (updateData.author_id !== undefined) dataToUpdate.author_id = updateData.author_id;
  if (updateData.categories !== undefined) dataToUpdate.categories = updateData.categories;
  if (updateData.stars !== undefined) dataToUpdate.stars = updateData.stars;
  if (updateData.count_star !== undefined) dataToUpdate.count_star = updateData.count_star;
  // Removed views field - now handled by storyStats collection
  if (updateData.is_full !== undefined) dataToUpdate.is_full = Boolean(updateData.is_full);
  if (updateData.is_hot !== undefined) dataToUpdate.is_hot = Boolean(updateData.is_hot);
  if (updateData.is_new !== undefined) dataToUpdate.is_new = Boolean(updateData.is_new);
  if (updateData.show_ads !== undefined) dataToUpdate.show_ads = Boolean(updateData.show_ads);
  if (updateData.hot_day !== undefined) dataToUpdate.hot_day = Boolean(updateData.hot_day);
  if (updateData.hot_month !== undefined) dataToUpdate.hot_month = Boolean(updateData.hot_month);
  if (updateData.hot_all_time !== undefined) dataToUpdate.hot_all_time = Boolean(updateData.hot_all_time);
  if (updateData.status !== undefined) dataToUpdate.status = Boolean(updateData.status);

  // Add paid content fields
  if (updateData.isPaid !== undefined) dataToUpdate.isPaid = Boolean(updateData.isPaid);
  if (updateData.price !== undefined) dataToUpdate.price = Number(updateData.price) || 0;

  // If name is updated but slug is not provided, regenerate the slug
  if (updateData.name && updateData.slug === undefined) {
    dataToUpdate.slug = slugify(updateData.name, {
      lower: true,
      strict: true,
      locale: 'vi'
    });
  }

  return await Story.findByIdAndUpdate(
    id,
    dataToUpdate,
    { new: true }
  ).populate('authors', 'name slug')
   .populate('categories', 'name slug');
};

/**
 * Cập nhật truyện với logic paid content business rules
 * @param {string} id - ID của truyện
 * @param {Object} updateData - Dữ liệu cần cập nhật
 * @returns {Promise<Object>} - Truyện sau khi cập nhật
 */
const updateStoryWithPaidContentLogic = async (id, updateData) => {
  // Chapter model is already imported at the top of the file

  // Kiểm tra story tồn tại
  const existingStory = await Story.findById(id);
  if (!existingStory) {
    throw new Error('Không tìm thấy truyện');
  }

  // BUSINESS LOGIC VALIDATION: isPaid và hasPaidChapters không được cùng true
  if (updateData.isPaid === true && updateData.hasPaidChapters === true) {
    throw new Error('Business Logic Violation: isPaid và hasPaidChapters không thể cùng là true. Chỉ được chọn một trong hai mô hình: Story-level purchase (isPaid=true) hoặc Chapter-level purchase (hasPaidChapters=true)');
  }

  // BUSINESS LOGIC: Model A - Story-level purchase
  if (updateData.isPaid === true && !existingStory.isPaid) {
    console.log(`[StoryService] Setting story ${id} to Model A (Story-level purchase)`);

    // Cập nhật tất cả chapters trong story thành free
    await Chapter.updateMany(
      { story_id: id },
      {
        $set: {
          isPaid: false,
          price: 0
        }
      }
    );

    // Đảm bảo hasPaidChapters = false cho Model A
    updateData.hasPaidChapters = false;

    console.log(`[StoryService] Updated story ${id} to Model A: All chapters free, story-level purchase required`);
  }

  // BUSINESS LOGIC: Model B - Chapter-level purchase
  if (updateData.hasPaidChapters === true && updateData.isPaid !== true) {
    console.log(`[StoryService] Setting story ${id} to Model B (Chapter-level purchase)`);

    // Đảm bảo isPaid = false cho Model B
    updateData.isPaid = false;
    updateData.price = 0;

    console.log(`[StoryService] Updated story ${id} to Model B: Individual chapter purchases allowed`);
  }

  // BUSINESS LOGIC: Free story
  if (updateData.isPaid === false && updateData.hasPaidChapters === false) {
    console.log(`[StoryService] Setting story ${id} to Free model`);

    // Cập nhật tất cả chapters thành free
    await Chapter.updateMany(
      { story_id: id },
      {
        $set: {
          isPaid: false,
          price: 0
        }
      }
    );

    updateData.price = 0;

    console.log(`[StoryService] Updated story ${id} to Free model: All chapters free`);
  }

  // Gọi updateStory thông thường
  return await updateStory(id, updateData);
};

/**
 * Xóa truyện
 * @param {string} id - ID của truyện cần xóa
 * @returns {Promise<Object>} - Truyện đã xóa
 */
const deleteStory = async (id) => {
  return await Story.findByIdAndDelete(id);
};

/**
 * Tăng lượt xem cho truyện
 * @param {string} slug - Slug của truyện
 * @returns {Promise<Object>} - Kết quả sau khi tăng lượt xem
 */
const incrementStoryViews = async (slug) => {
  // Tìm truyện theo slug với status published và approved
  const story = await Story.findOne({
    slug,
    status: 'published',
    approval_status: 'approved'
  });

  if (!story) {
    throw new Error('Story not found');
  }

  // Tăng lượt view trong bảng StoryStats
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Lấy thông tin ngày, tháng, năm, tuần
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const week = require('moment')(today).isoWeek();

    // Chuyển đổi story._id thành ObjectId
    const storyObjectId = new mongoose.Types.ObjectId(story._id);

    // Tìm hoặc tạo bản ghi thống kê cho ngày hôm nay
    let stats = await StoryStats.findOne({
      story_id: storyObjectId,
      date: today
    });

    if (!stats) {
      // Tạo bản ghi mới nếu chưa có
      stats = new StoryStats({
        story_id: storyObjectId,
        date: today,
        views: 1,
        unique_views: 1,
        ratings_count: 0,
        ratings_sum: 0,
        comments_count: 0,
        bookmarks_count: 0,
        shares_count: 0,
        day,
        month,
        year,
        week
      });
    } else {
      // Cập nhật bản ghi hiện có
      stats.views += 1;
      stats.unique_views += 1; // Đây chỉ là giá trị tạm thời, cần logic phức tạp hơn để đếm unique views
    }

    const savedStats = await stats.save();

    // Lấy tổng lượt xem từ StoryStats bằng aggregation
    const totalViewsResult = await StoryStats.aggregate([
      {
        $match: { story_id: storyObjectId }
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' }
        }
      }
    ]);

    const totalViews = totalViewsResult.length > 0 ? totalViewsResult[0].totalViews : 1;

    return { success: true, views: totalViews };
  } catch (error) {
    console.error('[API] Error updating StoryStats:', error);
    // Nếu có lỗi, trả về giá trị mặc định
    return { success: true, views: 1 };
  }
};

/**
 * Lấy danh sách truyện có nhiều bình luận nhất
 * Sử dụng MongoDB aggregation để đếm comments và sắp xếp
 */
const getMostCommentedStories = async (params) => {
  const {
    limit = 10,
    page = 1
  } = params;

  const limitNumber = parseInt(limit);
  const pageNumber = parseInt(page);
  const skipNumber = (pageNumber - 1) * limitNumber;

  try {
    // Sử dụng aggregation pipeline để đếm comments cho mỗi story
    const pipeline = [
      // Match only published and approved stories
      {
        $match: {
          status: 'published',
          approval_status: 'approved'
        }
      },
      // Lookup comments for each story
      {
        $lookup: {
          from: 'comments',
          let: { storyId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$target.story_id', '$$storyId'] },
                    { $eq: ['$moderation.status', 'active'] }
                  ]
                }
              }
            }
          ],
          as: 'comments'
        }
      },
      // Add comment count field
      {
        $addFields: {
          commentCount: { $size: '$comments' }
        }
      },
      // Sort by comment count (descending)
      {
        $sort: { commentCount: -1, createdAt: -1 }
      },
      // Skip and limit for pagination
      {
        $skip: skipNumber
      },
      {
        $limit: limitNumber
      },
      // Lookup author information
      {
        $lookup: {
          from: 'authors',
          localField: 'author_id',
          foreignField: '_id',
          as: 'author_id'
        }
      },
      // Lookup categories information
      {
        $lookup: {
          from: 'categories',
          localField: 'categories',
          foreignField: '_id',
          as: 'categories'
        }
      },
      // Project only needed fields
      {
        $project: {
          _id: 1,
          slug: 1,
          name: 1,
          image: 1,
          desc: 1,
          author_id: { name: 1 },
          categories: { name: 1, slug: 1 },
          views: 1,
          is_hot: 1,
          is_full: 1,
          chapter_count: 1,
          commentCount: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ];

    // Execute aggregation
    const stories = await Story.aggregate(pipeline);

    // Get total count for pagination
    const totalPipeline = [
      {
        $match: {
          status: true
        }
      },
      {
        $lookup: {
          from: 'comments',
          let: { storyId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$target.story_id', '$$storyId'] },
                    { $eq: ['$moderation.status', 'active'] }
                  ]
                }
              }
            }
          ],
          as: 'comments'
        }
      },
      {
        $addFields: {
          commentCount: { $size: '$comments' }
        }
      },
      {
        $match: {
          commentCount: { $gt: 0 }
        }
      },
      {
        $count: 'total'
      }
    ];

    const totalResult = await Story.aggregate(totalPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    return {
      stories,
      pagination: {
        total,
        totalPages: Math.ceil(total / limitNumber),
        currentPage: pageNumber,
        limit: limitNumber
      }
    };

  } catch (error) {
    console.error('Error in getMostCommentedStories:', error);
    throw new Error('Không thể lấy danh sách truyện có nhiều bình luận nhất');
  }
};

/**
 * Thêm thông tin thống kê từ storyStats vào danh sách stories
 * @param {Array} stories - Danh sách stories
 * @returns {Promise<Array>} - Danh sách stories với thống kê đầy đủ
 */
const addViewCountsToStories = async (stories) => {
  try {
    if (!stories || stories.length === 0) {
      return stories;
    }

    // Lấy danh sách story IDs
    const storyIds = stories.map(story => story._id);

    // Aggregate tất cả thống kê từ StoryStats
    const statsAggregation = await StoryStats.aggregate([
      {
        $match: {
          story_id: { $in: storyIds }
        }
      },
      {
        $group: {
          _id: '$story_id',
          totalViews: { $sum: '$views' },
          totalUniqueViews: { $sum: '$unique_views' },
          totalRatingsCount: { $sum: '$ratings_count' },
          totalRatingsSum: { $sum: '$ratings_sum' },
          totalCommentsCount: { $sum: '$comments_count' },
          totalBookmarksCount: { $sum: '$bookmarks_count' },
          totalSharesCount: { $sum: '$shares_count' }
        }
      }
    ]);

    // Tạo map để dễ lookup
    const statsMap = {};
    statsAggregation.forEach(item => {
      statsMap[item._id.toString()] = {
        views: item.totalViews || 0,
        unique_views: item.totalUniqueViews || 0,
        ratings_count: item.totalRatingsCount || 0,
        ratings_sum: item.totalRatingsSum || 0,
        comments_count: item.totalCommentsCount || 0,
        bookmarks_count: item.totalBookmarksCount || 0,
        shares_count: item.totalSharesCount || 0
      };
    });

    // Thêm thống kê vào stories
    const storiesWithStats = stories.map(story => {
      const storyObj = story.toObject ? story.toObject() : story;
      const storyId = storyObj._id.toString();

      // Lấy thống kê từ map hoặc sử dụng giá trị mặc định = 0
      const stats = statsMap[storyId] || {
        views: 0,
        unique_views: 0,
        ratings_count: 0,
        ratings_sum: 0,
        comments_count: 0,
        bookmarks_count: 0,
        shares_count: 0
      };

      // Gán các giá trị thống kê
      storyObj.views = stats.views;
      storyObj.unique_views = stats.unique_views;
      storyObj.ratings_count = stats.ratings_count;
      storyObj.ratings_sum = stats.ratings_sum;
      storyObj.comments_count = stats.comments_count;
      storyObj.bookmarks_count = stats.bookmarks_count;
      storyObj.shares_count = stats.shares_count;

      return storyObj;
    });

    return storiesWithStats;
  } catch (error) {
    console.error('Error adding stats to stories:', error);
    // Nếu có lỗi, trả về stories gốc với tất cả thống kê = 0
    return stories.map(story => {
      const storyObj = story.toObject ? story.toObject() : story;
      storyObj.views = 0;
      storyObj.unique_views = 0;
      storyObj.ratings_count = 0;
      storyObj.ratings_sum = 0;
      storyObj.comments_count = 0;
      storyObj.bookmarks_count = 0;
      storyObj.shares_count = 0;
      return storyObj;
    });
  }
};

module.exports = {
  getAllStories,
  getStoryById,
  getStoryBySlug,
  createStory,
  updateStory,
  updateStoryWithPaidContentLogic,
  deleteStory,
  incrementStoryViews,
  buildStoryQuery,
  processCategoryFilter,
  processMultipleCategoriesFilter,
  getMostCommentedStories,
  addViewCountsToStories
};