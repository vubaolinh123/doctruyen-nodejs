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

  // Filter by name if provided
  if (filters.name) {
    query.name = { $regex: filters.name, $options: 'i' };
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
  console.log("processMultipleCategoriesFilter - categoriesValue:", categoriesValue);

  // Kiểm tra nếu categoriesValue là undefined hoặc null
  if (!categoriesValue) {
    console.log("processMultipleCategoriesFilter - categoriesValue is undefined or null");
    return query;
  }

  // Handle both array and single value
  const categoryValues = Array.isArray(categoriesValue) ? categoriesValue : [categoriesValue];

  // Xử lý và làm sạch các giá trị
  const cleanCategoryValues = categoryValues
    .map(val => typeof val === 'string' ? val.trim() : val)
    .filter(val => val); // Lọc bỏ các giá trị rỗng

  console.log("processMultipleCategoriesFilter - cleanCategoryValues:", cleanCategoryValues);

  if (cleanCategoryValues.length > 0) {
    try {
      // Luôn xử lý như slug, vì frontend luôn gửi slug
      const Category = require('../../models/category');

      // Tìm tất cả thể loại theo slug - CHÍNH XÁC slug, không phải regex
      const categories = await Category.find({ slug: { $in: cleanCategoryValues } });

      console.log("processMultipleCategoriesFilter - MongoDB query:", { slug: { $in: cleanCategoryValues } });
      console.log("processMultipleCategoriesFilter - Found categories count:", categories.length);

      if (categories.length > 0) {
        console.log("processMultipleCategoriesFilter - Found categories:",
          categories.map(cat => ({
            _id: cat._id.toString(),
            name: cat.name,
            slug: cat.slug
          }))
        );

        // Lấy ID của các thể loại
        const categoryIds = categories.map(cat => cat._id);

        // Sử dụng $in để lấy truyện thuộc về MỘT TRONG các thể loại đã chọn
        query.categories = { $in: categoryIds };

        console.log("processMultipleCategoriesFilter - Updated query:", JSON.stringify(query));
      } else {
        // Thử tìm kiếm với regex để xem có vấn đề gì với slug không
        console.log("processMultipleCategoriesFilter - No categories found with exact match, trying with regex");

        const regexPromises = cleanCategoryValues.map(slug =>
          Category.findOne({ slug: new RegExp('^' + slug + '$', 'i') })
        );

        const regexResults = await Promise.all(regexPromises);
        const foundCategories = regexResults.filter(Boolean);

        console.log("processMultipleCategoriesFilter - Found categories with regex:",
          foundCategories.map(cat => ({
            _id: cat._id.toString(),
            name: cat.name,
            slug: cat.slug
          }))
        );

        if (foundCategories.length > 0) {
          // Lấy ID của các thể loại tìm thấy bằng regex
          const categoryIds = foundCategories.map(cat => cat._id);

          // Sử dụng $in để lấy truyện thuộc về MỘT TRONG các thể loại đã chọn
          query.categories = { $in: categoryIds };

          console.log("processMultipleCategoriesFilter - Updated query with regex results:", JSON.stringify(query));
        } else {
          console.log("processMultipleCategoriesFilter - No categories found even with regex for slugs:", cleanCategoryValues);

          // Liệt kê tất cả các thể loại trong DB để debug
          const allCategories = await Category.find({}).select('name slug');
          console.log("processMultipleCategoriesFilter - All categories in DB:",
            allCategories.map(cat => ({
              name: cat.name,
              slug: cat.slug
            }))
          );
        }
      }
    } catch (error) {
      console.error("processMultipleCategoriesFilter - Error:", error);
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

  console.log("getAllStories - Input filters:", JSON.stringify(filters));
  console.log("getAllStories - Categories from filters:", filters.categories);

  // Xử lý trực tiếp categories nếu có
  if (filters.categories) {
    console.log("getAllStories - Processing categories directly:", filters.categories);

    // Đảm bảo otherFilters.categories tồn tại
    otherFilters.categories = filters.categories;
  }

  // Xây dựng query dựa trên các bộ lọc
  const query = await buildStoryQuery(otherFilters);
  console.log("getAllStories - Final query:", JSON.stringify(query));

  // Xác định trường sắp xếp và thứ tự
  const sortField = otherFilters.sort_by || 'updatedAt';
  const sortOrder = otherFilters.sort_order === 'asc' ? 1 : -1;
  const sortOptions = {};

  // Nếu sắp xếp theo số lượng chapter, sử dụng trường chapter_count
  if (sortField === 'chapter_count') {
    sortOptions.chapter_count = sortOrder;
  } else {
    sortOptions[sortField] = sortOrder;
  }

  // Kiểm tra xem có lọc theo số lượng chapter không
  const hasChapterFilter = checkHasChapterFilter(otherFilters);
  const sortByChapterCount = otherFilters.sort_by === 'chapter_count';

  // Kiểm tra xem có yêu cầu thêm thông tin chapter không
  const includeChapterCount = otherFilters.include_chapter_count === 'true' || hasChapterFilter || sortByChapterCount;
  const includeLatestChapter = otherFilters.include_latest_chapter === 'true';

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
    query.is_hot = filters.is_hot === 'true';
  }

  if (filters.is_new !== undefined) {
    query.is_new = filters.is_new === 'true';
  }

  if (filters.is_full !== undefined) {
    query.is_full = filters.is_full === 'true';
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
  // Chuyển đổi kiểu dữ liệu của filters.chapter_count từ string sang number nếu cần
  if (filters.chapter_count && filters.chapter_count !== '') {
    filters.chapter_count = parseInt(filters.chapter_count);
  }

  return (filters.chapter_count !== undefined && filters.chapter_count !== '') ||
          (filters.chapter_count_op !== undefined && filters.chapter_count_op !== '') ||
          (filters.has_chapters !== undefined && filters.has_chapters !== '');
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
  // Nếu có lọc theo số lượng chapter hoặc sắp xếp theo số lượng chapter, cần xử lý thêm
  // Xử lý filter theo số lượng chapter
  if (hasChapterFilter) {
    processChapterCountFilters(query, filters);
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
  // Nếu có lọc theo has_chapters
  if (filters.has_chapters !== undefined) {
    const hasChaptersBool = filters.has_chapters === 'true';

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