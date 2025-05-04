const express = require('express');
const router = express.Router();
const controller = require('../controllers/chapterController');
const auth = require('../middleware/auth');

// Các route công khai, không cần xác thực
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.get('/story/:storyId', controller.getChaptersByStory);
router.get('/story/:storyId/latest', controller.getLatestChapter);

// Các route cần xác thực (thường là admin)
router.post('/', auth, controller.create);
router.put('/:id', auth, controller.update);
router.delete('/:id', auth, controller.remove);

module.exports = router;