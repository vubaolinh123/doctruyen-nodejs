const Chapter = require('../../models/chapter');
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
   * @returns {Promise<Object>} - Chapter tìm thấy với thông tin truyện
   */
  async getChapterById(id) {
    return await Chapter.findById(id).populate('story_id', 'name slug');
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

    // Tạo chapter mới
    const item = new Chapter(newChapterData);
    const savedChapter = await item.save();

    // Cập nhật chapter_count trong Story
    const currentCount = storyExists.chapter_count || 0;
    await Story.findByIdAndUpdate(
      chapterData.story_id,
      { chapter_count: currentCount + 1 }
    );
    return savedChapter;
  }

  /**
   * Cập nhật chapter
   * @param {string} id - ID của chapter
   * @param {Object} updateData - Dữ liệu cần cập nhật
   * @returns {Promise<Object>} - Chapter sau khi cập nhật
   */
  async updateChapter(id, updateData) {
    // Tìm chapter hiện tại để lấy story_id cũ
    const currentChapter = await Chapter.findById(id);
    if (!currentChapter) {
      throw new Error('Chapter not found');
    }

    const oldStoryId = currentChapter.story_id;
    const newStoryId = updateData.story_id;

    // Kiểm tra nếu có thay đổi story_id
    const isStoryChanged = newStoryId && newStoryId.toString() !== oldStoryId.toString();

    // Prepare update data
    const dataToUpdate = {};

    // Only update fields that are present in request
    if (updateData.kho_truyen_chapter_id !== undefined) dataToUpdate.kho_truyen_chapter_id = updateData.kho_truyen_chapter_id;
    if (updateData.story_id !== undefined) dataToUpdate.story_id = updateData.story_id;
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

    // Cập nhật chapter
    const updatedChapter = await Chapter.findByIdAndUpdate(
      id,
      dataToUpdate,
      { new: true }
    );

    // Nếu có thay đổi story_id, cập nhật chapter_count cho cả truyện cũ và mới
    if (isStoryChanged) {
      // Giảm chapter_count của truyện cũ
      const oldStory = await Story.findById(oldStoryId);
      if (oldStory) {
        const oldCount = oldStory.chapter_count || 0;
        if (oldCount > 0) {
          await Story.findByIdAndUpdate(
            oldStoryId,
            { chapter_count: oldCount - 1 }
          );
        }
      }

      // Tăng chapter_count của truyện mới
      const newStory = await Story.findById(newStoryId);
      if (newStory) {
        const newCount = newStory.chapter_count || 0;
        await Story.findByIdAndUpdate(
          newStoryId,
          { chapter_count: newCount + 1 }
        );
      }
    }

    return updatedChapter;
  }

  /**
   * Xóa chapter
   * @param {string} id - ID của chapter cần xóa
   * @returns {Promise<Object>} - Chapter đã xóa
   */
  async deleteChapter(id) {
    // Tìm chapter để lấy story_id trước khi xóa
    const chapter = await Chapter.findById(id);
    if (!chapter) {
      throw new Error('Chapter not found');
    }

    const storyId = chapter.story_id;

    // Xóa chapter
    const deletedChapter = await Chapter.findByIdAndDelete(id);

    // Cập nhật chapter_count trong Story
    if (storyId) {
      const story = await Story.findById(storyId);
      if (story) {
        const currentCount = story.chapter_count || 0;
        if (currentCount > 0) {
          await Story.findByIdAndUpdate(
            storyId,
            { chapter_count: currentCount - 1 }
          );
        }
      }
    }

    return deletedChapter;
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
   * Lấy số chương tiếp theo của một truyện
   * @param {string} storyId - ID của truyện
   * @returns {Promise<number>} - Số chương tiếp theo
   */
  async getNextChapterNumber(storyId) {
    try {
      // Kiểm tra storyId có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        throw new Error('ID truyện không hợp lệ');
      }

      // Tìm chapter có số chương lớn nhất của truyện
      const latestChapter = await Chapter.findOne({ story_id: storyId })
        .sort({ chapter: -1 })
        .limit(1);

      // Nếu không có chapter nào, trả về 1
      if (!latestChapter) {
        return 1;
      }

      // Trả về số chương tiếp theo
      return latestChapter.chapter + 1;
    } catch (error) {
      console.error(`[Service] Error in getNextChapterNumber: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lấy danh sách chapter theo truyện
   * @param {string} storyId - ID của truyện
   * @param {Object} options - Tùy chọn
   * @returns {Promise<Object>} - Danh sách chapter và thông tin truyện
   */
  async getChaptersByStory(storyId, options = {}) {
    try {
      const { excludeContent = false } = options;

      // Kiểm tra storyId có hợp lệ không
      if (!storyId || typeof storyId !== 'string') {
        console.error(`[Service] ID truyện không hợp lệ: ${storyId}`);
        throw new Error('ID truyện không hợp lệ');
      }

      // Kiểm tra storyId có phải là ObjectId hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        console.error(`[Service] ID truyện không phải là ObjectId hợp lệ: ${storyId}`);
        throw new Error('ID truyện không hợp lệ');
      }

      // Kiểm tra truyện tồn tại
      const story = await Story.findById(storyId);
      if (!story) {
        console.error(`[Service] Không tìm thấy truyện với ID: ${storyId}`);
        throw new Error('Không tìm thấy truyện');
      }

      // Tạo ObjectId từ storyId
      const storyObjectId = new mongoose.Types.ObjectId(storyId);

      // Xây dựng query với select fields
      let query = Chapter.find({ story_id: storyObjectId });

      // Nếu excludeContent = true, loại bỏ trường content
      if (excludeContent) {
        query = query.select('-content');
        console.log(`[Service] Loại bỏ trường content cho story ID: ${storyId}`);
      }

      // Lấy tất cả chapter của truyện
      const chapters = await query
        .sort({ chapter: 1 }) // Sắp xếp theo số chương tăng dần
        .lean();

      console.log(`[Service] Lấy được ${chapters.length} chapters cho story ID: ${storyId}, excludeContent: ${excludeContent}`);

      return {
        story,
        chapters,
        total: chapters.length
      };
    } catch (error) {
      console.error(`[Service] Lỗi khi lấy danh sách chapter theo story ID: ${storyId}`, error);
      throw error;
    }
  }

  /**
   * Lấy danh sách chapter theo truyện với pagination và search
   * @param {string} storyId - ID của truyện
   * @param {Object} options - Tùy chọn pagination và search
   * @returns {Promise<Object>} - Danh sách chapter với pagination metadata
   */
  async getChaptersByStoryWithPagination(storyId, options = {}) {
    try {
      const {
        page = 1,
        limit = 100,
        search = '',
        sort = 'chapter',
        excludeContent = false
      } = options;

      // Kiểm tra storyId có hợp lệ không
      if (!storyId || typeof storyId !== 'string') {
        console.error(`[Service] ID truyện không hợp lệ: ${storyId}`);
        throw new Error('ID truyện không hợp lệ');
      }

      // Kiểm tra storyId có phải là ObjectId hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        console.error(`[Service] ID truyện không phải là ObjectId hợp lệ: ${storyId}`);
        throw new Error('ID truyện không hợp lệ');
      }

      // Kiểm tra truyện tồn tại
      const story = await Story.findById(storyId);
      if (!story) {
        console.error(`[Service] Không tìm thấy truyện với ID: ${storyId}`);
        throw new Error('Không tìm thấy truyện');
      }

      // Tạo ObjectId từ storyId
      const storyObjectId = new mongoose.Types.ObjectId(storyId);

      // Xây dựng query filter
      const query = { story_id: storyObjectId };

      // Thêm search filter nếu có - search toàn bộ chapters của story
      if (search && search.trim()) {
        const searchTerm = search.trim();
        const searchNumber = parseInt(searchTerm);

        // Tạo query OR để tìm kiếm linh hoạt hơn
        const searchQuery = [];

        // Nếu search là số, tìm theo chapter number
        if (!isNaN(searchNumber)) {
          searchQuery.push({ chapter: searchNumber });
        }

        // Luôn tìm theo tên chapter (case-insensitive)
        searchQuery.push({ name: { $regex: searchTerm, $options: 'i' } });

        // Nếu search term chứa "chapter" hoặc "chương", tìm theo pattern
        if (searchTerm.toLowerCase().includes('chapter') || searchTerm.toLowerCase().includes('chương')) {
          const numberMatch = searchTerm.match(/\d+/);
          if (numberMatch) {
            searchQuery.push({ chapter: parseInt(numberMatch[0]) });
          }
        }

        // Áp dụng OR query
        query.$or = searchQuery;
      }

      // Xây dựng sort object
      let sortObject = {};
      if (sort === 'chapter') {
        sortObject = { chapter: 1 };
      } else if (sort === '-chapter') {
        sortObject = { chapter: -1 };
      } else if (sort === 'name') {
        sortObject = { name: 1 };
      } else if (sort === '-name') {
        sortObject = { name: -1 };
      } else if (sort === 'createdAt') {
        sortObject = { createdAt: 1 };
      } else if (sort === '-createdAt') {
        sortObject = { createdAt: -1 };
      } else {
        sortObject = { chapter: 1 }; // Default sort
      }

      // Tính toán pagination
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skipNumber = (pageNumber - 1) * limitNumber;

      // Xây dựng query với select fields
      let chapterQuery = Chapter.find(query);

      // Nếu excludeContent = true, loại bỏ trường content
      if (excludeContent) {
        chapterQuery = chapterQuery.select('-content');
        console.log(`[Service] Loại bỏ trường content cho pagination, story ID: ${storyId}`);
      }

      // Thực hiện query với pagination
      const [chapters, totalItems] = await Promise.all([
        chapterQuery
          .sort(sortObject)
          .skip(skipNumber)
          .limit(limitNumber)
          .lean(),
        Chapter.countDocuments(query)
      ]);

      // Tính toán pagination metadata
      const totalPages = Math.ceil(totalItems / limitNumber);
      const hasNext = pageNumber < totalPages;
      const hasPrevious = pageNumber > 1;

      console.log(`[Service] Tìm thấy ${chapters.length}/${totalItems} chapter cho story ID: ${storyId}, page: ${pageNumber}/${totalPages}`);

      return {
        chapters,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          limit: limitNumber,
          hasNext,
          hasPrevious
        }
      };
    } catch (error) {
      console.error(`[Service] Lỗi khi lấy danh sách chapter với pagination cho story ID: ${storyId}`, error);
      throw error;
    }
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