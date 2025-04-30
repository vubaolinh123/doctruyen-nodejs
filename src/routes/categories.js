const express = require('express');
const router = express.Router();
const controller = require('../controllers/categoryController');

// Basic CRUD routes
router.get('/', controller.getAll);
router.get('/active', controller.getActive);
router.get('/slug/:slug', controller.getBySlug);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;