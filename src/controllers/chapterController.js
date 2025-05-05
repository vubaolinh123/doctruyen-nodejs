const Chapter = require('../models/Chapter');
const Story = require('../models/Story');
const mongoose = require('mongoose');

exports.getAll = async (req, res) => {
  try {
    const items = await Chapter.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const item = await Chapter.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    // Validate story_id
    if (!mongoose.Types.ObjectId.isValid(req.body.story_id)) {
      return res.status(400).json({ error: 'Invalid story_id' });
    }

    // Check if story exists
    const storyExists = await Story.findById(req.body.story_id);
    if (!storyExists) {
      return res.status(400).json({ error: 'Story not found' });
    }

    // Create chapter with new model structure
    const chapterData = {
      kho_truyen_chapter_id: req.body.kho_truyen_chapter_id || 0,
      story_id: req.body.story_id,
      chapter: req.body.chapter,
      name: req.body.name,
      slug: req.body.slug || '',
      content: req.body.content || '',
      audio: req.body.audio || '',
      audio_show: Boolean(req.body.audio_show),
      show_ads: Boolean(req.body.show_ads),
      link_ref: req.body.link_ref || '',
      pass_code: req.body.pass_code || '',
      is_new: Boolean(req.body.is_new),
      status: Boolean(req.body.status)
    };

    const item = new Chapter(chapterData);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    // Prepare update data
    const updateData = {};

    // Only update fields that are present in request
    if (req.body.kho_truyen_chapter_id !== undefined) updateData.kho_truyen_chapter_id = req.body.kho_truyen_chapter_id;
    if (req.body.chapter !== undefined) updateData.chapter = req.body.chapter;
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.slug !== undefined) updateData.slug = req.body.slug;
    if (req.body.content !== undefined) updateData.content = req.body.content;
    if (req.body.audio !== undefined) updateData.audio = req.body.audio;
    if (req.body.audio_show !== undefined) updateData.audio_show = Boolean(req.body.audio_show);
    if (req.body.show_ads !== undefined) updateData.show_ads = Boolean(req.body.show_ads);
    if (req.body.link_ref !== undefined) updateData.link_ref = req.body.link_ref;
    if (req.body.pass_code !== undefined) updateData.pass_code = req.body.pass_code;
    if (req.body.is_new !== undefined) updateData.is_new = Boolean(req.body.is_new);
    if (req.body.status !== undefined) updateData.status = Boolean(req.body.status);

    const item = await Chapter.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await Chapter.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get chapters by story ID
exports.getChaptersByStory = async (req, res) => {
  try {
    const storyId = req.params.storyId;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }

    const chapters = await Chapter.find({ story_id: storyId })
      .sort({ chapter: 1 });

    res.json(chapters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get latest chapter by story ID
exports.getLatestChapter = async (req, res) => {
  try {
    const storyId = req.params.storyId;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }

    const chapter = await Chapter.findLatestByStory(storyId);

    if (!chapter) {
      return res.status(404).json({ error: 'No chapters found' });
    }

    res.json(chapter);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy thông tin chi tiết của một chapter theo slug
exports.getChapterBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    // Debug: Kiểm tra tất cả các chapter có trong database
    const allChapters = await Chapter.find().select('slug name chapter');

    // Tìm chapter theo slug hoặc một phần của slug
    let chapter = await Chapter.findOne({ slug, status: true });

    // Nếu không tìm thấy, thử tìm với slug chứa một phần của slug đã cho
    if (!chapter) {
      const regex = new RegExp(slug, 'i');
      chapter = await Chapter.findOne({ slug: regex, status: true });
    }

    console.log('Kết quả tìm kiếm chapter:', chapter ? `Tìm thấy: ${chapter.slug}` : 'Không tìm thấy');

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chapter'
      });
    }

    // Lấy thông tin truyện
    const story = await Story.findById(chapter.story_id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện của chapter này'
      });
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

    return res.json({
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
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
};

// Lấy thông tin chi tiết của một chapter theo slug của chapter và slug của truyện
exports.getChapterByStoryAndChapterSlug = async (req, res) => {
  try {
    const { storySlug, chapterSlug } = req.params;

    console.log(`[API] Lấy chapter theo slug truyện: ${storySlug} và slug chapter: ${chapterSlug}`);

    // Tìm truyện theo slug
    const story = await Story.findOne({ slug: storySlug });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    // Tìm chapter theo slug và story_id
    let chapter = await Chapter.findOne({
      slug: chapterSlug,
      story_id: story._id,
      status: true
    });

    // Nếu không tìm thấy, thử tìm với slug chứa một phần của slug đã cho
    if (!chapter) {
      const regex = new RegExp(chapterSlug, 'i');
      chapter = await Chapter.findOne({
        slug: regex,
        story_id: story._id,
        status: true
      });
    }

    console.log('Kết quả tìm kiếm chapter:', chapter ? `Tìm thấy: ${chapter.slug}` : 'Không tìm thấy');

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chapter trong truyện này'
      });
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

    return res.json({
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
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
};

// Lấy danh sách slug của tất cả các chapter của một truyện theo slug của truyện
exports.getChaptersByStorySlug = async (req, res) => {
  try {
    const { storySlug } = req.params;
    console.log(`[API] Lấy danh sách slug chapter theo slug truyện: ${storySlug}`);

    // Tìm truyện theo slug
    const story = await Story.findOne({ slug: storySlug });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    // Lấy danh sách chapter của truyện
    const chapters = await Chapter.find({
      story_id: story._id,
      status: true
    })
    .select('chapter name slug')
    .sort({ chapter: 1 });

    return res.json({
      success: true,
      story: {
        id: story._id,
        name: story.name,
        slug: story.slug
      },
      chapters: chapters.map(ch => ({
        id: ch._id,
        chapter: ch.chapter,
        name: ch.name,
        slug: ch.slug
      })),
      total: chapters.length
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: err.message
    });
  }
};