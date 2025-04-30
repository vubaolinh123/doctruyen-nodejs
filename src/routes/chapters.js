const express = require('express');
const router = express.Router();
const controller = require('../controllers/chapterController');

// Basic CRUD routes
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

// Additional routes for story-related operations
router.get('/story/:storyId', controller.getChaptersByStory);
router.get('/story/:storyId/latest', controller.getLatestChapter);

module.exports = router;