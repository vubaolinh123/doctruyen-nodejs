const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * Xây dựng query cho truyện dựa trên các bộ lọc
 * @param {Object} filters - Các tham số lọc
 * @returns {Promise<Object>} - Query đã xây dựng
 */
const buildStoryQuery = async (filters) => {
  let query = {};

  console.log("[API] Lấy danh sách truyện - page:", filters.page, "limit:", filters.limit, "search:", filters.search, "categories:", filters.categories);
  console.log("[API] Chapter filters - chapter_count:", filters.chapter_count, "chapter_count_op:", filters.chapter_count_op, "has_chapters:", filters.has_chapters);

  // Filter by status if provided
  if (filters.status !== undefined) {
    query.status = filters.status === 'true';
  }

  // Filter by single category if provided
  if (filters.category) {
    console.log("buildStoryQuery - Processing single category:", filters.category);
    query = await processCategoryFilter(query, filters.category);
    console.log("buildStoryQuery - Query after processCategoryFilter:", JSON.stringify(query));
  }

  // Filter by multiple categories if provided
  if (filters.categories) {
    console.log("buildStoryQuery - Processing multiple categories:", filters.categories);
    query = await processMultipleCategoriesFilter(query, filters.categories);
    console.log("buildStoryQuery - Query after processMultipleCategoriesFilter:", JSON.stringify(query));
  }

  // Filter by author if provided
  if (filters.author) {
    query.author_id = filters.author;
  }

  // Filter by name or search if provided
  if (filters.name) {
    query.name = { $regex: filters.name, $options: 'i' };
    console.log("buildStoryQuery - Filtering by name:", filters.name);
  } else if (filters.search) {
    query.name = { $regex: filters.search, $options: 'i' };
    console.log("buildStoryQuery - Filtering by search:", filters.search);
  }

  // Filter by slug if provided
  if (filters.slug) {
    query.slug = filters.slug;
  }

  // Filter by flags if provided
  processFlagsFilters(query, filters);

  console.log("buildStoryQuery - Final query:", JSON.stringify(query));
  return query;
};

/**
 * Xử lý filter theo một category
 * @param {Object} query - Query đang xây dựng
 * @param {string} categoryValue - Giá trị category cần lọc
 * @returns {Promise<Object>} - Query đã cập nhật
 */
const processCategoryFilter = async (query, categoryValue) => {
  console.log("processCategoryFilter - categoryValue:", categoryValue);

  if (mongoose.Types.ObjectId.isValid(categoryValue)) {
    // Sử dụng trực tiếp ID
    query.categories = categoryValue;
    console.log("processCategoryFilter - Using ID directly:", categoryValue);
  } else {
    try {
      // Nếu là slug, cần tìm category trước
      const Category = require('../../models/category');

      // Tìm chính xác slug
      const category = await Category.findOne({ slug: categoryValue });

      if (category) {
        // Sử dụng ID của category
        query.categories = category._id;
        console.log("processCategoryFilter - Found category by slug:", categoryValue, "ID:", category._id);
      } else {
        console.log("processCategoryFilter - Category not found for slug:", categoryValue);

        // Thử tìm kiếm với regex
        console.log("processCategoryFilter - Trying with regex");
        const regexCategory = await Category.findOne({
          slug: new RegExp('^' + categoryValue + '$', 'i')
        });

        if (regexCategory) {
          // Sử dụng ID của category tìm thấy bằng regex
          query.categories = regexCategory._id;
          console.log("processCategoryFilter - Found category by regex:", categoryValue, "ID:", regexCategory._id);
        } else {
          console.log("processCategoryFilter - Category not found even with regex for slug:", categoryValue);

          // Liệt kê tất cả các thể loại trong DB để debug
          const allCategories = await Category.find({}).select('name slug');
          console.log("processCategoryFilter - All categories in DB:",
            allCategories.map(cat => ({
              name: cat.name,
              slug: cat.slug
            }))
          );
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
      const Category = require('../../models/category');

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
  const { page = 1, limit = 10, ...otherFilters } = filters;

  console.log("getAllStories - Input filters:", filters);

  // Xử lý trực tiếp categories nếu có
  if (filters.categories) {
    // Đảm bảo otherFilters.categories tồn tại
    otherFilters.categories = filters.categories;
  }

  // Xử lý trực tiếp các tham số liên quan đến chapter
  if (filters.chapter_count) {
    otherFilters.chapter_count = filters.chapter_count;
    console.log("getAllStories - Setting chapter_count:", filters.chapter_count);
  }

  if (filters.chapter_count_op) {
    otherFilters.chapter_count_op = filters.chapter_count_op;
    console.log("getAllStories - Setting chapter_count_op:", filters.chapter_count_op);
  }

  if (filters.has_chapters) {
    otherFilters.has_chapters = filters.has_chapters;
    console.log("getAllStories - Setting has_chapters:", filters.has_chapters);
  }

  // Xây dựng query dựa trên các bộ lọc
  const query = await buildStoryQuery(otherFilters);

  // Xác định trường sắp xếp và thứ tự
  const sortField = otherFilters.sort_by || 'updatedAt';
  const sortOrder = otherFilters.sort_order === 'asc' ? 1 : -1;
  const sortOptions = {};

  console.log("getAllStories - Sort params:", { sortField, sortOrder });

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

  console.log("getAllStories - Final sort options:", sortOptions);

  // Kiểm tra xem có lọc theo số lượng chapter không
  const hasChapterFilter = checkHasChapterFilter(otherFilters);
  const sortByChapterCount = otherFilters.sort_by === 'chapter_count';

  console.log("getAllStories - hasChapterFilter:", hasChapterFilter);
  console.log("getAllStories - sortByChapterCount:", sortByChapterCount);

  // Kiểm tra xem có yêu cầu thêm thông tin chapter không
  const includeChapterCount = otherFilters.include_chapter_count === 'true' || hasChapterFilter || sortByChapterCount;
  const includeLatestChapter = otherFilters.include_latest_chapter === 'true';

  console.log("getAllStories - includeChapterCount:", includeChapterCount);
  console.log("getAllStories - includeLatestChapter:", includeLatestChapter);

  // Nếu không có lọc theo số lượng chapter và không sắp xếp theo số lượng chapter, thực hiện truy vấn bình thường
  if (!hasChapterFilter && !sortByChapterCount) {
    console.log("getAllStories - Using getStoriesWithoutChapterFilters");
    return await getStoriesWithoutChapterFilters(query, sortOptions, page, limit, includeChapterCount, includeLatestChapter);
  } else {
    console.log("getAllStories - Using getStoriesWithChapterFilters");
    return await getStoriesWithChapterFilters(query, sortOptions, page, limit, includeLatestChapter, hasChapterFilter, otherFilters);
  }
};



/**
 * Xử lý các bộ lọc theo flags
 * @param {Object} query - Query đang xây dựng
 * @param {Object} filters - Các tham số lọc flags
 */
const processFlagsFilters = (query, filters) => {
  console.log("processFlagsFilters - Input filters:", filters);

  // Filter by flags
  if (filters.is_hot !== undefined) {
    query.is_hot = filters.is_hot === 'true';
    console.log("processFlagsFilters - Setting is_hot:", query.is_hot);
  }

  if (filters.is_new !== undefined) {
    query.is_new = filters.is_new === 'true';
    console.log("processFlagsFilters - Setting is_new:", query.is_new);
  }

  if (filters.is_full !== undefined) {
    query.is_full = filters.is_full === 'true';
    console.log("processFlagsFilters - Setting is_full:", query.is_full);
  }

  // Filter by hot_day, hot_month, hot_all_time
  if (filters.hot_day !== undefined) {
    query.hot_day = filters.hot_day === 'true';
    console.log("processFlagsFilters - Setting hot_day:", query.hot_day);
  }

  if (filters.hot_month !== undefined) {
    query.hot_month = filters.hot_month === 'true';
    console.log("processFlagsFilters - Setting hot_month:", query.hot_month);
  }

  if (filters.hot_all_time !== undefined) {
    query.hot_all_time = filters.hot_all_time === 'true';
    console.log("processFlagsFilters - Setting hot_all_time:", query.hot_all_time);
  }

  console.log("processFlagsFilters - Final query:", JSON.stringify(query));
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

  // Log để debug
  console.log("checkHasChapterFilter - Params:", {
    chapter_count: filters.chapter_count,
    chapter_count_op: filters.chapter_count_op,
    has_chapters: filters.has_chapters,
    hasChapterCount,
    hasChapterCountOp,
    hasHasChapters
  });

  // Chuyển đổi kiểu dữ liệu của filters.chapter_count từ string sang number nếu cần
  if (hasChapterCount) {
    filters.chapter_count = parseInt(filters.chapter_count);
    console.log("checkHasChapterFilter - Converted chapter_count to number:", filters.chapter_count);
  }

  // Trả về true nếu có ít nhất một tham số chapter
  const result = hasChapterCount || hasChapterCountOp || hasHasChapters;
  console.log("checkHasChapterFilter - Result:", result);
  return result;
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

    // Trả về kết quả với thông tin chapter
    return {
      items: storiesWithChapterInfo,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    };
  } else {
    // Trả về kết quả không có thông tin chapter
    return {
      items,
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
  console.log("getStoriesWithChapterFilters - Input query:", JSON.stringify(query));
  console.log("getStoriesWithChapterFilters - hasChapterFilter:", hasChapterFilter);
  console.log("getStoriesWithChapterFilters - filters:", filters);

  // Nếu có lọc theo số lượng chapter hoặc sắp xếp theo số lượng chapter, cần xử lý thêm
  // Xử lý filter theo số lượng chapter
  if (hasChapterFilter) {
    processChapterCountFilters(query, filters);
    console.log("getStoriesWithChapterFilters - Query after processChapterCountFilters:", JSON.stringify(query));
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

  // Trả về kết quả
  return {
    items: paginatedItems,
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
  console.log("processChapterCountFilters - Input filters:", filters);

  // Nếu có lọc theo has_chapters
  if (filters.has_chapters !== undefined && filters.has_chapters !== '') {
    const hasChaptersBool = filters.has_chapters === 'true';
    console.log("processChapterCountFilters - Processing has_chapters:", hasChaptersBool);

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

    console.log("processChapterCountFilters - Processing chapter_count:", chapterCountNum, "with operator:", chapterCountOp);

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
    console.log("processChapterCountFilters - Processing chapter_count without operator:", chapterCountNum);
    query.chapter_count = chapterCountNum;
  }

  console.log("processChapterCountFilters - Final query:", JSON.stringify(query));
};

/**
 * Lấy truyện theo ID
 * @param {string} id - ID của truyện
 * @returns {Promise<Object>} - Truyện tìm thấy
 */
const getStoryById = async (id) => {
  return await Story.findById(id)
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');
};

/**
 * Lấy truyện theo slug
 * @param {string} slug - Slug của truyện
 * @returns {Promise<Object>} - Truyện tìm thấy với thông tin bổ sung
 */
const getStoryBySlug = async (slug) => {
  const item = await Story.findBySlug(slug)
    .populate('author_id', 'name slug')
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

  return storyData;
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
    views: storyData.views || 0,
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
  if (updateData.views !== undefined) dataToUpdate.views = updateData.views;
  if (updateData.is_full !== undefined) dataToUpdate.is_full = Boolean(updateData.is_full);
  if (updateData.is_hot !== undefined) dataToUpdate.is_hot = Boolean(updateData.is_hot);
  if (updateData.is_new !== undefined) dataToUpdate.is_new = Boolean(updateData.is_new);
  if (updateData.show_ads !== undefined) dataToUpdate.show_ads = Boolean(updateData.show_ads);
  if (updateData.hot_day !== undefined) dataToUpdate.hot_day = Boolean(updateData.hot_day);
  if (updateData.hot_month !== undefined) dataToUpdate.hot_month = Boolean(updateData.hot_month);
  if (updateData.hot_all_time !== undefined) dataToUpdate.hot_all_time = Boolean(updateData.hot_all_time);
  if (updateData.status !== undefined) dataToUpdate.status = Boolean(updateData.status);

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
  // Tìm truyện theo slug
  const story = await Story.findOne({ slug, status: true });

  if (!story) {
    throw new Error('Story not found');
  }

  // Tăng lượt view lên 1
  story.views += 1;
  await story.save();

  return { success: true, views: story.views };
};

module.exports = {
  getAllStories,
  getStoryById,
  getStoryBySlug,
  createStory,
  updateStory,
  deleteStory,
  incrementStoryViews,
  buildStoryQuery,
  processCategoryFilter,
  processMultipleCategoriesFilter
};