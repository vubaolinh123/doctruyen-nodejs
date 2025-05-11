const express = require('express');
const router = express.Router();
const controller = require('../controllers/chapter');
const auth = require('../middleware/auth');

// Các route công khai, không cần xác thực
router.get('/', controller.getAll);
// Đặt các route cụ thể trước
router.get('/debug/slugs', async (req, res) => {
  try {
    const Chapter = require('../models/Chapter');
    const chapters = await Chapter.find().select('slug name chapter');
    res.json({
      success: true,
      total: chapters.length,
      chapters: chapters.map(ch => ({
        slug: ch.slug,
        chapter: ch.chapter,
        name: ch.name
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router.get('/slug/:slug', controller.getChapterBySlug);
router.get('/story/:storySlug/chapter/:chapterSlug', controller.getChapterByStoryAndChapterSlug);
router.get('/story/slug/:storySlug', controller.getChaptersByStorySlug);
router.get('/story/:storyId/latest', controller.getLatestChapter);
router.get('/story/:storyId', controller.getChaptersByStory);
// Đặt route với tham số động ở cuối cùng
router.get('/:id', controller.getById);

// Các route cần xác thực (thường là admin)
router.post('/', auth, controller.create);
router.put('/:id', auth, controller.update);
router.delete('/:id', auth, controller.remove);

module.exports = router;