const Chapter = require('../../models/Chapter');
const Story = require('../../models/Story');
const mongoose = require('mongoose');

/**
 * Lấy tất cả các chapter
 * @returns {Promise<Array>} - Danh sách chapter
 */
const getAllChapters = async () => {
  return await Chapter.find();
};

/**
 * Lấy chapter theo ID
 * @param {string} id - ID của chapter
 * @returns {Promise<Object>} - Chapter tìm thấy
 */
const getChapterById = async (id) => {
  return await Chapter.findById(id);
};

/**
 * Tạo chapter mới
 * @param {Object} chapterData - Dữ liệu chapter cần tạo
 * @returns {Promise<Object>} - Chapter đã tạo
 * @throws {Error} - Nếu story_id không hợp lệ hoặc không tìm thấy story
 */
const createChapter = async (chapterData) => {
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
};

/**
 * Cập nhật chapter
 * @param {string} id - ID của chapter
 * @param {Object} updateData - Dữ liệu cần cập nhật
 * @returns {Promise<Object>} - Chapter sau khi cập nhật
 */
const updateChapter = async (id, updateData) => {
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
};

/**
 * Xóa chapter
 * @param {string} id - ID của chapter cần xóa
 * @returns {Promise<Object>} - Chapter đã xóa
 */
const deleteChapter = async (id) => {
  return await Chapter.findByIdAndDelete(id);
};

/**
 * Lấy chapter theo story ID
 * @param {string} storyId - ID của truyện
 * @returns {Promise<Array>} - Danh sách chapter của truyện
 * @throws {Error} - Nếu story ID không hợp lệ
 */
const getChaptersByStory = async (storyId) => {
  if (!mongoose.Types.ObjectId.isValid(storyId)) {
    throw new Error('Invalid story ID');
  }

  return await Chapter.find({ story_id: storyId })
    .sort({ chapter: 1 });
};

/**
 * Lấy chapter mới nhất theo story ID
 * @param {string} storyId - ID của truyện
 * @returns {Promise<Object>} - Chapter mới nhất
 * @throws {Error} - Nếu story ID không hợp lệ hoặc không tìm thấy chapter
 */
const getLatestChapter = async (storyId) => {
  if (!mongoose.Types.ObjectId.isValid(storyId)) {
    throw new Error('Invalid story ID');
  }

  const chapter = await Chapter.findLatestByStory(storyId);

  if (!chapter) {
    throw new Error('No chapters found');
  }

  return chapter;
};

/**
 * Lấy thông tin chi tiết của một chapter theo slug
 * @param {string} slug - Slug của chapter
 * @returns {Promise<Object>} - Thông tin chi tiết của chapter
 * @throws {Error} - Nếu không tìm thấy chapter hoặc truyện
 */
const getChapterBySlug = async (slug) => {
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
  const prevChapter = await Chapter.findPreviousChapter(story._id, chapter.chapter);
  const nextChapter = await Chapter.findNextChapter(story._id, chapter.chapter);

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
};

/**
 * Lấy thông tin chi tiết của một chapter theo slug của chapter và slug của truyện
 * @param {string} storySlug - Slug của truyện
 * @param {string} chapterSlug - Slug của chapter
 * @returns {Promise<Object>} - Thông tin chi tiết của chapter
 * @throws {Error} - Nếu không tìm thấy truyện hoặc chapter
 */
const getChapterByStoryAndChapterSlug = async (storySlug, chapterSlug) => {
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
  const prevChapter = await Chapter.findPreviousChapter(story._id, chapter.chapter);
  const nextChapter = await Chapter.findNextChapter(story._id, chapter.chapter);

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
};

/**
 * Lấy danh sách chapter theo slug của truyện
 * @param {string} storySlug - Slug của truyện
 * @returns {Promise<Object>} - Danh sách chapter và thông tin truyện
 * @throws {Error} - Nếu không tìm thấy truyện
 */
const getChaptersByStorySlug = async (storySlug) => {
  // Tìm truyện theo slug
  const story = await Story.findOne({ slug: storySlug, status: true });

  if (!story) {
    throw new Error('Không tìm thấy truyện');
  }

  // Lấy danh sách chapter của truyện
  const chapters = await Chapter.find({
    story_id: story._id,
    status: true
  }).sort({ chapter: 1 });

  return {
    success: true,
    story: {
      id: story._id,
      name: story.name,
      slug: story.slug
    },
    chapters: chapters.map(chapter => ({
      id: chapter._id,
      chapter: chapter.chapter,
      name: chapter.name,
      slug: chapter.slug,
      createdAt: chapter.createdAt
    }))
  };
};

module.exports = {
  getAllChapters,
  getChapterById,
  createChapter,
  updateChapter,
  deleteChapter,
  getChaptersByStory,
  getLatestChapter,
  getChapterBySlug,
  getChapterByStoryAndChapterSlug,
  getChaptersByStorySlug
}; 