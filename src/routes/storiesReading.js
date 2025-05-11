const express = require('express');
const router = express.Router();
const controller = require('../controllers/storiesReading');

// Routes CRUD cơ bản
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

// Routes đặc biệt
router.get('/user/:userId', controller.findByUser);
router.get('/user/:userId/story/:storyId', controller.findByUserAndStory);
router.post('/user/:userId/story/:storyId', controller.upsertReading);
router.put('/user/:userId/story/:storyId/read', controller.updateChapterRead);

module.exports = router;