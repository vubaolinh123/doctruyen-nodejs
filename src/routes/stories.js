const express = require('express');
const router = express.Router();
const controller = require('../controllers/storyController');

// Basic CRUD routes
router.get('/', controller.getAll);
router.get('/hot', controller.getHotStories);
router.get('/top-rated', controller.getTopRatedStories);
router.get('/recent', controller.getRecentStories);
router.get('/category/:categoryId', controller.getStoriesByCategory);
router.get('/author/:authorId', controller.getStoriesByAuthor);
router.get('/search', controller.searchStories);
router.get('/slug/:slug', controller.getBySlug);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;