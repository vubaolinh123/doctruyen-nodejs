const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const storyStatsService = require('../storyStats/storyStatsService');

/**
 * Thêm thông tin stats vào truyện
 * @param {Object|Array} stories - Truyện hoặc danh sách truyện cần thêm stats
 * @returns {Promise<Object|Array>} - Truyện hoặc danh sách truyện đã thêm stats
 */
const addStatsToStories = async (stories) => {
  if (!stories) return stories;

  // Nếu là một truyện duy nhất
  if (!Array.isArray(stories)) {
    return await addStatsToStory(stories);
  }

  // Nếu là danh sách truyện
  return await Promise.all(stories.map(story => addStatsToStory(story)));
};

/**
 * Thêm thông tin stats vào một truyện
 * @param {Object} story - Truyện cần thêm stats
 * @returns {Promise<Object>} - Truyện đã thêm stats
 */
const addStatsToStory = async (story) => {
  if (!story) return story;

  try {
    // Chuyển đổi thành object nếu là document Mongoose
    const storyObj = story.toObject ? story.toObject() : { ...story };

    // Lấy tất cả thống kê từ StoryStats
    const allStats = await storyStatsService.getAllStats(storyObj._id);

    // Gán lại giá trị views từ StoryStats
    storyObj.views = allStats.totalViews;

    // Gán lại giá trị ratings từ StoryStats
    storyObj.ratings_count = allStats.ratings.ratingsCount;
    storyObj.ratings_sum = allStats.ratings.ratingsSum;

    // Thêm thông tin thống kê chi tiết
    storyObj.stats = {
      views: {
        total: allStats.totalViews,
        byTimeRange: allStats.viewsByTimeRange,
        daily: allStats.dailyStats.views
      },
      ratings: {
        count: allStats.ratings.ratingsCount,
        sum: allStats.ratings.ratingsSum,
        average: allStats.ratings.averageRating,
        daily: {
          count: allStats.dailyStats.ratings_count,
          sum: allStats.dailyStats.ratings_sum
        }
      }
    };

    return storyObj;
  } catch (error) {
    console.error(`Error adding stats to story ${story._id}:`, error);
    // Nếu có lỗi, trả về truyện gốc
    return story;
  }
};

/**
 * Lấy danh sách truyện hot
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện hot
 */
const getHotStories = async (limit = 10) => {
  const stories = await Story.findHotStories(parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');

  // Thêm thông tin stats vào mỗi truyện
  return await addStatsToStories(stories);
};

/**
 * Lấy danh sách truyện có đánh giá cao nhất
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện có đánh giá cao
 */
const getTopRatedStories = async (limit = 10) => {
  try {
    // Lấy từ bảng StoryRankings
    const StoryRankings = require('../../models/storyRankings');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rankings = await StoryRankings.find({
      date: today,
      all_time_rank: { $gt: 0 }
    })
      .sort({ all_time_rank: 1 })
      .limit(parseInt(limit))
      .populate({
        path: 'story_id',
        select: 'name slug image desc categories author_id views is_full is_hot is_new',
        populate: [
          { path: 'categories', select: 'name slug' },
          { path: 'author_id', select: 'name slug' }
        ]
      });

    if (rankings && rankings.length > 0) {
      // Trả về danh sách truyện từ xếp hạng với thông tin stats
      const stories = rankings.map(r => r.story_id);
      return await addStatsToStories(stories);
    }

    // Nếu không có dữ liệu từ StoryRankings, lấy truyện có lượt xem cao nhất
    console.log('No rankings data available, falling back to views-based sorting');
    const stories = await Story.find({ status: true })
      .sort({ views: -1 })
      .limit(parseInt(limit))
      .populate('author_id', 'name slug')
      .populate('categories', 'name slug');

    return await addStatsToStories(stories);
  } catch (error) {
    console.error('Error getting top rated stories:', error);

    // Fallback nếu có lỗi
    const stories = await Story.find({ status: true })
      .sort({ views: -1 })
      .limit(parseInt(limit))
      .populate('author_id', 'name slug')
      .populate('categories', 'name slug');

    return await addStatsToStories(stories);
  }
};

/**
 * Lấy danh sách truyện được cập nhật gần đây
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện gần đây
 */
const getRecentStories = async (limit = 10) => {
  const stories = await Story.findRecentlyUpdated(parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');

  // Thêm thông tin stats vào mỗi truyện
  return await addStatsToStories(stories);
};

/**
 * Lấy danh sách truyện theo thể loại
 * @param {string} categoryId - ID của thể loại
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện theo thể loại
 */
const getStoriesByCategory = async (categoryId, limit = 10) => {
  const stories = await Story.findByCategory(categoryId, parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');

  // Thêm thông tin stats vào mỗi truyện
  return await addStatsToStories(stories);
};

/**
 * Lấy danh sách truyện theo tác giả
 * @param {string} authorId - ID của tác giả
 * @param {number} limit - Số lượng truyện cần lấy
 * @returns {Promise<Array>} - Danh sách truyện theo tác giả
 */
const getStoriesByAuthor = async (authorId, limit = 10) => {
  const stories = await Story.findByAuthor(authorId, parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');

  // Thêm thông tin stats vào mỗi truyện
  return await addStatsToStories(stories);
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

  const stories = await Story.search(keyword, parseInt(limit))
    .populate('authors', 'name slug')
    .populate('categories', 'name slug');

  // Thêm thông tin stats vào mỗi truyện
  return await addStatsToStories(stories);
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

  // Lấy chapter mới nhất cho mỗi truyện và thêm thông tin stats
  const storiesWithInfo = await Promise.all(
    stories.map(async (story) => {
      // Chuyển đổi thành object
      const storyObj = story.toObject();

      // Lấy chapter mới nhất
      const latestChapter = await Chapter.findOne({ story_id: story._id })
        .sort({ chapter: -1 })
        .select('chapter name createdAt');
      storyObj.latest_chapter = latestChapter;

      // Lấy thông tin stats
      try {
        const allStats = await storyStatsService.getAllStats(story._id);

        // Gán lại giá trị views từ StoryStats
        storyObj.views = allStats.totalViews;

        // Gán lại giá trị ratings từ StoryStats
        storyObj.ratings_count = allStats.ratings.ratingsCount;
        storyObj.ratings_sum = allStats.ratings.ratingsSum;

        // Thêm thông tin thống kê chi tiết
        storyObj.stats = {
          views: {
            total: allStats.totalViews,
            byTimeRange: allStats.viewsByTimeRange,
            daily: allStats.dailyStats.views
          },
          ratings: {
            count: allStats.ratings.ratingsCount,
            sum: allStats.ratings.ratingsSum,
            average: allStats.ratings.averageRating,
            daily: {
              count: allStats.dailyStats.ratings_count,
              sum: allStats.dailyStats.ratings_sum
            }
          }
        };
      } catch (error) {
        console.error(`Error adding stats to story ${story._id}:`, error);
      }

      return storyObj;
    })
  );

  return {
    success: true,
    stories: storiesWithInfo
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

  // Lấy chapter mới nhất cho mỗi truyện và thêm thông tin stats
  const storiesWithInfo = await Promise.all(
    stories.map(async (story) => {
      // Chuyển đổi thành object
      const storyObj = story.toObject();

      // Lấy chapter mới nhất
      const latestChapter = await Chapter.findOne({ story_id: story._id })
        .sort({ chapter: -1 })
        .select('chapter name createdAt');
      storyObj.latest_chapter = latestChapter;

      // Lấy thông tin stats
      try {
        const allStats = await storyStatsService.getAllStats(story._id);

        // Gán lại giá trị views từ StoryStats
        storyObj.views = allStats.totalViews;

        // Gán lại giá trị ratings từ StoryStats
        storyObj.ratings_count = allStats.ratings.ratingsCount;
        storyObj.ratings_sum = allStats.ratings.ratingsSum;

        // Thêm thông tin thống kê chi tiết
        storyObj.stats = {
          views: {
            total: allStats.totalViews,
            byTimeRange: allStats.viewsByTimeRange,
            daily: allStats.dailyStats.views
          },
          ratings: {
            count: allStats.ratings.ratingsCount,
            sum: allStats.ratings.ratingsSum,
            average: allStats.ratings.averageRating,
            daily: {
              count: allStats.dailyStats.ratings_count,
              sum: allStats.dailyStats.ratings_sum
            }
          }
        };
      } catch (error) {
        console.error(`Error adding stats to story ${story._id}:`, error);
      }

      return storyObj;
    })
  );

  return {
    success: true,
    stories: storiesWithInfo
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

  // Lấy chapter mới nhất cho mỗi truyện và thêm thông tin stats
  const storiesWithInfo = await Promise.all(
    suggestedStories.map(async (story) => {
      // Chuyển đổi thành object
      const storyObj = story.toObject();

      // Lấy chapter mới nhất
      const latestChapter = await Chapter.findOne({ story_id: story._id })
        .sort({ chapter: -1 })
        .select('chapter name createdAt');
      storyObj.latest_chapter = latestChapter;

      // Lấy thông tin stats
      try {
        const allStats = await storyStatsService.getAllStats(story._id);

        // Gán lại giá trị views từ StoryStats
        storyObj.views = allStats.totalViews;

        // Gán lại giá trị ratings từ StoryStats
        storyObj.ratings_count = allStats.ratings.ratingsCount;
        storyObj.ratings_sum = allStats.ratings.ratingsSum;

        // Thêm thông tin thống kê chi tiết
        storyObj.stats = {
          views: {
            total: allStats.totalViews,
            byTimeRange: allStats.viewsByTimeRange,
            daily: allStats.dailyStats.views
          },
          ratings: {
            count: allStats.ratings.ratingsCount,
            sum: allStats.ratings.ratingsSum,
            average: allStats.ratings.averageRating,
            daily: {
              count: allStats.dailyStats.ratings_count,
              sum: allStats.dailyStats.ratings_sum
            }
          }
        };
      } catch (error) {
        console.error(`Error adding stats to story ${story._id}:`, error);
      }

      return storyObj;
    })
  );

  return {
    items: storiesWithInfo,
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