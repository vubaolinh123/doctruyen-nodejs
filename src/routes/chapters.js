const express = require('express');
const router = express.Router();
const controller = require('../controllers/chapter');
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth.middleware');

// ==========================================================
// CÁC ROUTE CÔNG KHAI (PUBLIC)
// ==========================================================

// Lấy tất cả chapter
router.get('/', controller.getAll);

// Debug slugs (hỗ trợ kiểm tra)
router.get('/debug/slugs', async (req, res) => {
  try {
    const Chapter = require('../models/chapter');
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

// ==========================================================
// CÁC ROUTE ADMIN (CẦN XÁC THỰC)
// ==========================================================

// Admin - Lấy danh sách chapter có phân trang và lọc
router.get('/admin', auth, controller.getChapters);

// Admin - Lấy chi tiết một chapter
router.get('/admin/:id', auth, controller.getById);

// Admin - Tạo chapter mới
router.post('/admin', auth, controller.create);

// Admin - Cập nhật thông tin chapter
router.put('/admin/:id', auth, controller.update);

// Admin - Xóa chapter
router.delete('/admin/:id', auth, controller.remove);

// Admin - Lấy danh sách truyện cho dropdown
router.get('/admin/stories/list', auth, controller.getStoriesForDropdown);

// Admin - Lấy danh sách chapter theo truyện
router.get('/admin/story/:storyId', auth, controller.getChaptersByStory);

// Admin - Lấy số chương tiếp theo của một truyện
router.get('/admin/story/:storyId/next-chapter', auth, controller.getNextChapterNumber);

// Admin - Bật/tắt trạng thái chapter
router.put('/admin/:id/toggle-status', auth, controller.toggleStatus);

// Admin - Bật/tắt cờ chapter
router.put('/admin/:id/toggle-flag', auth, controller.toggleFlag);

// ==========================================================
// CÁC ROUTE SPECIFIC (ĐƯỜNG DẪN CỤ THỂ)
// ==========================================================

// Lấy chapter theo slug
router.get('/slug/:slug', controller.getChapterBySlug);

// Lấy tất cả chapter của một truyện (theo slug) - với access control
router.get('/story/slug/:storySlug', optionalAuth, controller.getChaptersByStorySlug);

// Lấy chapter theo story slug và chapter slug
router.get('/story/:storySlug/chapter/:chapterSlug', controller.getChapterByStoryAndChapterSlug);

// CRITICAL FIX: Add missing access control route for chapter reading page
router.get('/access-control/:storySlug/:chapterSlug', optionalAuth, controller.getChapterWithAccessControl);

// Test route
router.get('/test-access-control', (req, res) => {
  console.log('[TEST] Test access control route called');
  res.json({ success: true, message: 'Test route working' });
});

// Lấy chapter mới nhất của một truyện
router.get('/story/:storyId/latest', controller.getLatestChapter);

// Lấy tất cả chapter của một truyện (theo ID)
router.get('/story/:storyId', controller.getChaptersByStory);

// Tăng lượt xem cho chapter
router.post('/increment-views/:chapterSlug', controller.incrementViews);

// ==========================================================
// CÁC ROUTE THAM SỐ ĐỘNG (ĐẶT CUỐI CÙNG)
// ==========================================================

// Lấy chapter theo ID
router.get('/:id', controller.getById);

// CRUD operations cho public (cần xác thực)
router.post('/', auth, controller.create);
router.put('/:id', auth, controller.update);
router.delete('/:id', auth, controller.remove);

module.exports = router;