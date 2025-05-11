const Chapter = require('../../models/Chapter');
const Story = require('../../models/story');
const mongoose = require('mongoose');
const slugify = require('slugify');

class ChapterService {
  /**
   * Lấy tất cả các chapter
   * @returns {Promise<Array>} - Danh sách chapter
   */
  async getAllChapters() {
    return await Chapter.find();
  }

  /**
   * Lấy chapter theo ID
   * @param {string} id - ID của chapter
   * @returns {Promise<Object>} - Chapter tìm thấy
   */
  async getChapterById(id) {
    return await Chapter.findById(id);
  }

  /**
   * Tạo chapter mới
   * @param {Object} chapterData - Dữ liệu chapter cần tạo
   * @returns {Promise<Object>} - Chapter đã tạo
   * @throws {Error} - Nếu story_id không hợp lệ hoặc không tìm thấy story
   */
  async createChapter(chapterData) {
    // Validate story_id
    if (!mongoose.Types.ObjectId.isValid(chapterData.story_id)) {
      throw new Error('Invalid story_id');
    }

    // Check if story exists
    const storyExists = await Story.findById(chapterData.story_id);
    if (!storyExists) {
      throw new Error('Story not found');
    }

    // Create chapter with new model structure
    const newChapterData = {
      kho_truyen_chapter_id: chapterData.kho_truyen_chapter_id || 0,
      story_id: chapterData.story_id,
      chapter: chapterData.chapter,
      name: chapterData.name,
      slug: chapterData.slug || '',
      content: chapterData.content || '',
      audio: chapterData.audio || '',
      audio_show: Boolean(chapterData.audio_show),
      show_ads: Boolean(chapterData.show_ads),
      link_ref: chapterData.link_ref || '',
      pass_code: chapterData.pass_code || '',
      is_new: Boolean(chapterData.is_new),
      status: chapterData.status !== undefined ? Boolean(chapterData.status) : true
    };

    const item = new Chapter(newChapterData);
    return await item.save();
  }

  /**
   * Cập nhật chapter
   * @param {string} id - ID của chapter
   * @param {Object} updateData - Dữ liệu cần cập nhật
   * @returns {Promise<Object>} - Chapter sau khi cập nhật
   */
  async updateChapter(id, updateData) {
    // Prepare update data
    const dataToUpdate = {};

    // Only update fields that are present in request
    if (updateData.kho_truyen_chapter_id !== undefined) dataToUpdate.kho_truyen_chapter_id = updateData.kho_truyen_chapter_id;
    if (updateData.chapter !== undefined) dataToUpdate.chapter = updateData.chapter;
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.slug !== undefined) dataToUpdate.slug = updateData.slug;
    if (updateData.content !== undefined) dataToUpdate.content = updateData.content;
    if (updateData.audio !== undefined) dataToUpdate.audio = updateData.audio;
    if (updateData.audio_show !== undefined) dataToUpdate.audio_show = Boolean(updateData.audio_show);
    if (updateData.show_ads !== undefined) dataToUpdate.show_ads = Boolean(updateData.show_ads);
    if (updateData.link_ref !== undefined) dataToUpdate.link_ref = updateData.link_ref;
    if (updateData.pass_code !== undefined) dataToUpdate.pass_code = updateData.pass_code;
    if (updateData.is_new !== undefined) dataToUpdate.is_new = Boolean(updateData.is_new);
    if (updateData.status !== undefined) dataToUpdate.status = Boolean(updateData.status);

    return await Chapter.findByIdAndUpdate(
      id,
      dataToUpdate,
      { new: true }
    );
  }

  /**
   * Xóa chapter
   * @param {string} id - ID của chapter cần xóa
   * @returns {Promise<Object>} - Chapter đã xóa
   */
  async deleteChapter(id) {
    return await Chapter.findByIdAndDelete(id);
  }

  /**
   * Lấy chapter theo story ID
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Array>} - Danh sách chapter của truyện
   * @throws {Error} - Nếu story ID không hợp lệ
   */
  async findByStoryId(storyId) {
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      throw new Error('Invalid story ID');
    }

    return await Chapter.find({ story_id: storyId })
      .sort({ chapter: 1 });
  }

  /**
   * Lấy chapter mới nhất theo story ID
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Object>} - Chapter mới nhất
   * @throws {Error} - Nếu story ID không hợp lệ hoặc không tìm thấy chapter
   */
  async getLatestChapter(storyId) {
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      throw new Error('Invalid story ID');
    }

    const chapter = await Chapter.findOne({ story_id: storyId })
      .sort({ chapter: -1 })
      .limit(1);

    if (!chapter) {
      throw new Error('No chapters found');
    }

    return chapter;
  }

  /**
   * Lấy thông tin chi tiết của một chapter theo slug
   * @param {string} slug - Slug của chapter
   * @returns {Promise<Object>} - Thông tin chi tiết của chapter
   * @throws {Error} - Nếu không tìm thấy chapter hoặc truyện
   */
  async getChapterBySlug(slug) {
    // Tìm chapter theo slug hoặc một phần của slug
    let chapter = await Chapter.findOne({ slug, status: true });

    // Nếu không tìm thấy, thử tìm với slug chứa một phần của slug đã cho
    if (!chapter) {
      const regex = new RegExp(slug, 'i');
      chapter = await Chapter.findOne({ slug: regex, status: true });
    }

    if (!chapter) {
      throw new Error('Không tìm thấy chapter');
    }

    // Lấy thông tin truyện
    const story = await Story.findById(chapter.story_id);

    if (!story) {
      throw new Error('Không tìm thấy truyện của chapter này');
    }

    // Lấy tổng số chapter của truyện
    const totalChapters = await Chapter.countDocuments({
      story_id: story._id,
      status: true
    });

    // Lấy chapter trước và sau
    const prevChapter = await Chapter.findOne({
      story_id: story._id,
      chapter: { $lt: chapter.chapter },
      status: true
    }).sort({ chapter: -1 });

    const nextChapter = await Chapter.findOne({
      story_id: story._id,
      chapter: { $gt: chapter.chapter },
      status: true
    }).sort({ chapter: 1 });

    // Tạo đối tượng navigation
    const navigation = {
      prev: prevChapter ? {
        id: prevChapter._id,
        chapter: prevChapter.chapter,
        name: prevChapter.name,
        slug: prevChapter.slug
      } : null,
      next: nextChapter ? {
        id: nextChapter._id,
        chapter: nextChapter.chapter,
        name: nextChapter.name,
        slug: nextChapter.slug
      } : null
    };

    return {
      success: true,
      chapter: {
        _id: chapter._id,
        chapter: chapter.chapter,
        name: chapter.name,
        content: chapter.content,
        slug: chapter.slug,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt
      },
      story: {
        id: story._id,
        name: story.name,
        slug: story.slug
      },
      navigation,
      totalChapters
    };
  }

  /**
   * Lấy thông tin chi tiết của một chapter theo slug của chapter và slug của truyện
   * @param {string} storySlug - Slug của truyện
   * @param {string} chapterSlug - Slug của chapter
   * @returns {Promise<Object>} - Thông tin chi tiết của chapter
   * @throws {Error} - Nếu không tìm thấy truyện hoặc chapter
   */
  async getChapterByStoryAndChapterSlug(storySlug, chapterSlug) {
    // Tìm truyện theo slug
    const story = await Story.findOne({ slug: storySlug });

    if (!story) {
      throw new Error('Không tìm thấy truyện');
    }

    // Tìm chapter theo slug và story_id
    let chapter = await Chapter.findOne({
      slug: chapterSlug,
      story_id: story._id,
      status: true
    });

    if (!chapter) {
      throw new Error('Không tìm thấy chapter');
    }

    // Lấy tổng số chapter của truyện
    const totalChapters = await Chapter.countDocuments({
      story_id: story._id,
      status: true
    });

    // Lấy chapter trước và sau
    const prevChapter = await Chapter.findOne({
      story_id: story._id,
      chapter: { $lt: chapter.chapter },
      status: true
    }).sort({ chapter: -1 });

    const nextChapter = await Chapter.findOne({
      story_id: story._id,
      chapter: { $gt: chapter.chapter },
      status: true
    }).sort({ chapter: 1 });

    // Tạo đối tượng navigation
    const navigation = {
      prev: prevChapter ? {
        id: prevChapter._id,
        chapter: prevChapter.chapter,
        name: prevChapter.name,
        slug: prevChapter.slug
      } : null,
      next: nextChapter ? {
        id: nextChapter._id,
        chapter: nextChapter.chapter,
        name: nextChapter.name,
        slug: nextChapter.slug
      } : null
    };

    return {
      success: true,
      chapter: {
        _id: chapter._id,
        chapter: chapter.chapter,
        name: chapter.name,
        content: chapter.content,
        slug: chapter.slug,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt
      },
      story: {
        id: story._id,
        name: story.name,
        slug: story.slug
      },
      navigation,
      totalChapters
    };
  }

  /**
   * Lấy danh sách chapter theo slug của truyện
   * @param {string} storySlug - Slug của truyện
   * @returns {Promise<Array>} - Danh sách chapter
   * @throws {Error} - Nếu không tìm thấy truyện
   */
  async getChaptersByStorySlug(storySlug) {
    // Tìm truyện theo slug
    const story = await Story.findOne({ slug: storySlug });

    if (!story) {
      throw new Error('Không tìm thấy truyện');
    }

    // Lấy tất cả chapter của truyện
    const chapters = await Chapter.find({
      story_id: story._id,
      status: true
    }).sort({ chapter: 1 }).select('_id name chapter slug createdAt');

    return chapters;
  }

  /**
   * Lấy danh sách chapter có phân trang và lọc
   * @param {Object} options - Các tùy chọn
   * @returns {Promise<Object>} - Chapters và thông tin phân trang
   */
  async getChapters(options) {
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
    } = options;

    // Nếu yêu cầu đếm số lượng chapter theo truyện
    if (count_by_story === true || count_by_story === 'true') {
      // Đếm số lượng chapter theo story_id
      const chapterCounts = await Chapter.aggregate([
        { $group: { _id: "$story_id", count: { $sum: 1 } } }
      ]);

      // Chuyển đổi ObjectId thành string để dễ so sánh
      const formattedChapterCounts = chapterCounts.map(item => {
        const storyIdStr = item._id ? item._id.toString() : '';
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
        return {
          ...item,
          _id: itemIdStr,
          story_id: storyIdStr
        };
      });

      return {
        chapterCounts: formattedChapterCounts,
        latestChapters: formattedLatestChapters
      };
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
      query.status = status === 'true' || status === true;
    }

    // Lọc theo cờ is_new
    if (is_new !== undefined) {
      query.is_new = is_new === 'true' || is_new === true;
    }

    // Lọc theo cờ audio_show
    if (audio_show !== undefined) {
      query.audio_show = audio_show === 'true' || audio_show === true;
    }

    // Lọc theo cờ show_ads
    if (show_ads !== undefined) {
      query.show_ads = show_ads === 'true' || show_ads === true;
    }

    // Lọc theo truyện
    if (story_id) {
      if (!mongoose.Types.ObjectId.isValid(story_id)) {
        throw new Error('ID truyện không hợp lệ');
      }

      query.story_id = new mongoose.Types.ObjectId(story_id);
    }

    // Thực hiện truy vấn với phân trang
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skipNumber = (pageNumber - 1) * limitNumber;

    const [chapters, total] = await Promise.all([
      Chapter.find(query)
        .populate('story_id', 'name slug')
        .sort(sort)
        .skip(skipNumber)
        .limit(limitNumber),
      Chapter.countDocuments(query)
    ]);

    return {
      chapters,
      pagination: {
        total,
        totalPages: Math.ceil(total / limitNumber),
        currentPage: pageNumber,
        limit: limitNumber
      }
    };
  }

  /**
   * Chuyển đổi trạng thái chapter
   * @param {string} id - ID của chapter
   * @returns {Promise<Object>} - Chapter với trạng thái mới
   */
  async toggleStatus(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('ID chapter không hợp lệ');
    }

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      throw new Error('Không tìm thấy chapter');
    }

    chapter.status = !chapter.status;
    await chapter.save();

    return {
      chapter,
      status: chapter.status
    };
  }

  /**
   * Chuyển đổi cờ (is_new, audio_show, show_ads)
   * @param {string} id - ID của chapter
   * @param {string} flag - Tên cờ cần chuyển đổi
   * @returns {Promise<Object>} - Chapter với cờ mới
   */
  async toggleFlag(id, flag) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('ID chapter không hợp lệ');
    }

    const validFlags = ['is_new', 'audio_show', 'show_ads'];
    if (!flag || !validFlags.includes(flag)) {
      throw new Error('Flag không hợp lệ');
    }

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      throw new Error('Không tìm thấy chapter');
    }

    chapter[flag] = !chapter[flag];
    await chapter.save();

    return {
      chapter,
      flag,
      value: chapter[flag]
    };
  }

  /**
   * Lấy danh sách chapter theo truyện
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Object>} - Danh sách chapter và thông tin truyện
   */
  async getChaptersByStory(storyId) {
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      throw new Error('ID truyện không hợp lệ');
    }

    // Kiểm tra truyện tồn tại
    const story = await Story.findById(storyId);
    if (!story) {
      throw new Error('Không tìm thấy truyện');
    }

    // Kiểm tra xem storyId có phải là ObjectId hợp lệ không
    const storyObjectId = new mongoose.Types.ObjectId(storyId);

    // Lấy tất cả chapter của truyện
    const chapters = await Chapter.find({ story_id: storyObjectId })
      .sort({ chapter: 1 }) // Sắp xếp theo số chương tăng dần
      .lean();

    return {
      story,
      chapters,
      total: chapters.length
    };
  }

  /**
   * Lấy danh sách truyện cho dropdown
   * @returns {Promise<Array>} - Danh sách truyện
   */
  async getStoriesForDropdown() {
    // Lấy danh sách truyện với các trường cần thiết
    const stories = await Story.find({}, 'name slug')
      .sort({ name: 1 }) // Sắp xếp theo tên
      .lean();

    return stories;
  }
}

module.exports = new ChapterService();