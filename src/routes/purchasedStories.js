const express = require('express');
const router = express.Router();
const controller = require('../controllers/purchasedStory');

// Các routes CRUD cơ bản
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

// Các routes đặc biệt
router.get('/check/:userId/:storyId', controller.checkPurchased);
router.get('/user/:userId', controller.findByCustomer);
router.post('/purchase/:userId/:storyId', controller.purchaseStory);

module.exports = router;