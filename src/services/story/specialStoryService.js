const Story = require('../../models/story');
const Chapter = require('../../models/chapter');

/**
 * Lấy danh sách truyện hot
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện hot
 */
const getHotStories = async (limit = 10) => {
  return await Story.findHotStories(parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');
};

/**
 * Lấy danh sách truyện có đánh giá cao nhất
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện có đánh giá cao
 */
const getTopRatedStories = async (limit = 10) => {
  return await Story.findTopRatedStories(parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');
};

/**
 * Lấy danh sách truyện được cập nhật gần đây
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện gần đây
 */
const getRecentStories = async (limit = 10) => {
  return await Story.findRecentlyUpdated(parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');
};

/**
 * Lấy danh sách truyện theo thể loại
 * @param {string} categoryId - ID của thể loại
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện theo thể loại
 */
const getStoriesByCategory = async (categoryId, limit = 10) => {
  return await Story.findByCategory(categoryId, parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');
};

/**
 * Lấy danh sách truyện theo tác giả
 * @param {string} authorId - ID của tác giả
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện theo tác giả
 */
const getStoriesByAuthor = async (authorId, limit = 10) => {
  return await Story.findByAuthor(authorId, parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');
};

/**
 * Tìm kiếm truyện theo từ khóa
 * @param {string} keyword - Từ khóa tìm kiếm
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện tìm thấy
 * @throws {Error} - Nếu keyword không được cung cấp
 */
const searchStories = async (keyword, limit = 10) => {
  if (!keyword) {
    throw new Error('Keyword is required');
  }

  return await Story.search(keyword, parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');
};

/**
 * Lấy danh sách truyện mới (có is_new = true)
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Object>} - Kết quả chứa danh sách truyện mới
 */
const getNewStories = async (limit = 10) => {
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

  return {
    success: true,
    stories: storiesWithChapterInfo
  };
};

/**
 * Lấy danh sách truyện đã hoàn thành (có is_full = true)
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Object>} - Kết quả chứa danh sách truyện đã hoàn thành
 */
const getFullStories = async (limit = 10) => {
  // Tìm truyện có is_full = true và status = true
  const stories = await Story.find({
    is_full: true,
    status: true
  })
    .sort({ updatedAt: -1 })
    .limit(parseInt(limit))
    .populate('author_id', 'name slug')
    .populate('categories', 'name slug');

  // Lấy chapter mới nhất cho mỗi truyện
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

  return {
    success: true,
    stories: storiesWithChapterInfo
  };
};

/**
 * Lấy danh sách truyện đề xuất dựa trên thể loại và lượt xem
 * @param {Object} options - Các tùy chọn để lấy truyện đề xuất
 * @returns {Promise<Object>} - Kết quả chứa danh sách truyện đề xuất
 */
const getSuggestedStories = async (options = {}) => {
  const {
    storyId,
    page = 1,
    limit = 6,
    sortBy = 'views',
    sortOrder = 'desc',
    categoryFilter
  } = options;

  // Tạo query cơ bản
  let query = { status: true };
  let categoryIds = [];

  // Nếu có storyId, lấy thông tin truyện và thể loại của nó
  if (storyId) {
    // Kiểm tra storyId có phải là ObjectId hợp lệ không
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      throw new Error('Invalid story ID');
    }

    // Lấy thông tin truyện hiện tại
    const currentStory = await Story.findById(storyId);
    if (!currentStory) {
      throw new Error('Story not found');
    }

    // Lấy danh sách thể loại của truyện hiện tại
    categoryIds = currentStory.categories;

    // Loại trừ truyện hiện tại khỏi kết quả
    query._id = { $ne: storyId };

    // Nếu không có thể loại nào, trả về danh sách trống
    if (!categoryIds || categoryIds.length === 0) {
      return {
        items: [],
        total: 0,
        totalPages: 0,
        currentPage: parseInt(page)
      };
    }

    // Thêm điều kiện lọc theo thể loại của truyện hiện tại
    query.categories = { $in: categoryIds };
  }
  // Nếu không có storyId nhưng có categoryFilter, lọc theo categoryFilter
  else if (categoryFilter) {
    // Kiểm tra categoryFilter có phải là ObjectId hợp lệ không
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(categoryFilter)) {
      throw new Error('Invalid category ID');
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
  if (storyId || categoryFilter) {
    total = await Story.countDocuments(query);
  }

  // Lấy chapter mới nhất cho mỗi truyện
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

  return {
    items: storiesWithChapterInfo,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page)
  };
};

module.exports = {
  getHotStories,
  getTopRatedStories,
  getRecentStories,
  getStoriesByCategory,
  getStoriesByAuthor,
  searchStories,
  getNewStories,
  getFullStories,
  getSuggestedStories
};