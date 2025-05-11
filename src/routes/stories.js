const express = require('express');
const router = express.Router();
const controller = require('../controllers/story');
const auth = require('../middleware/auth');

// Các route công khai, không cần xác thực
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
router.get('/:id', controller.getById);

// Các route cần xác thực (thường là admin)
router.post('/', auth, controller.create);
router.put('/:id', auth, controller.update);
router.delete('/:id', auth, controller.remove);

module.exports = router;