const express = require('express');
const router = express.Router();
const controller = require('../controllers/categoryController');
const auth = require('../middleware/auth');

// Các route công khai, không cần xác thực
router.get('/', controller.getAll);
router.get('/active', controller.getActive);
router.get('/slug/:slug', controller.getBySlug);
router.get('/:id', controller.getById);

// Các route cần xác thực người dùng (thường là admin)
router.post('/', auth, controller.create);
router.put('/:id', auth, controller.update);
router.delete('/:id', auth, controller.remove);

module.exports = router;