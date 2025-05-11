const express = require('express');
const router = express.Router();
const controller = require('../controllers/story');
const specialController = require('../controllers/story/specialController');
const auth = require('../middleware/auth');

// ============================================
// CÁC ROUTE CÔNG KHAI (PUBLIC)
// ============================================

// Danh sách truyện
router.get('/', controller.getAll);
router.get('/hot', controller.getHotStories);
router.get('/top-rated', controller.getTopRatedStories);
router.get('/recent', controller.getRecentStories);
router.get('/new', controller.getNewStories);
router.get('/suggest', controller.getSuggestedStories);
router.get('/category/:categoryId', controller.getStoriesByCategory);
router.get('/author/:authorId', controller.getStoriesByAuthor);
router.get('/search', controller.searchStories);
router.get('/slug/:slug', controller.getBySlug);
router.post('/increment-views/:slug', controller.incrementViews);
// Route này được đặt cuối cùng để tránh xung đột với các route khác
router.get('/:id', controller.getById);

// ============================================
// CÁC ROUTE ADMIN (CẦN XÁC THỰC)
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
router.get('/admin', auth, controller.getAll);
router.get('/admin/:id', auth, controller.getById);

module.exports = router;