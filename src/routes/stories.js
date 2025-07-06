const express = require('express');
const router = express.Router();
const controller = require('../controllers/story');
const specialController = require('../controllers/story/specialController');
const auth = require('../middleware/auth');
const { optional } = require('../middleware/auth');

// ============================================
// CÁC ROUTE CÔNG KHAI (PUBLIC)
// ============================================

// Danh sách truyện - sử dụng optional auth để hỗ trợ cả public và admin
router.get('/', optional, controller.getAll);
router.get('/popular', controller.getPopularStories);
router.get('/hot', controller.getHotStories);
router.get('/top-rated', controller.getTopRatedStories);
router.get('/recent', controller.getRecentStories);
router.get('/new', controller.getNewStories);
router.get('/full', controller.getFullStories);
router.get('/completed', controller.getFullStories); // Alias for /full - completed stories
router.get('/most-commented', controller.getMostCommented);
router.get('/suggest', controller.getSuggestedStories);
router.get('/category/:categoryId', controller.getStoriesByCategory);
router.get('/author/:authorId', controller.getStoriesByAuthor);
router.get('/search', controller.searchStories);
router.get('/slug/:slug', controller.getBySlug);
router.post('/increment-views/:slug', controller.incrementViews);

// ============================================
// CÁC ROUTE ADMIN (CẦN XÁC THỰC) - ĐẶT TRƯỚC ROUTE /:id
// ============================================

// CRUD cơ bản
router.post('/', auth, controller.create);
router.put('/:id', auth, controller.update);
router.delete('/:id', auth, controller.remove);

// Các route admin riêng biệt
router.get('/admin/categories/list', auth, specialController.getCategoriesList);
router.get('/admin/authors/list', auth, specialController.getAuthorsList);
router.put('/admin/:id/toggle-status', auth, specialController.toggleStatus);
router.put('/admin/:id/toggle-flag', auth, specialController.toggleFlag);

// Route admin cho danh sách truyện (nếu cần xử lý riêng)
router.get('/admin', (req, res, next) => {
  console.log('=== ROUTE HIT ===');
  console.log('[ROUTE DEBUG] /admin route hit with query:', req.query);
  console.log('[ROUTE DEBUG] Request URL:', req.url);
  console.log('[ROUTE DEBUG] Request method:', req.method);
  console.log('=================');
  next();
}, auth, controller.getAll);
router.get('/admin/:id', auth, controller.getById);

// Route này được đặt cuối cùng để tránh xung đột với các route khác
router.get('/:id', controller.getById);

module.exports = router;