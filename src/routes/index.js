const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/user');

// Các route công khai, không cần xác thực
router.use('/stories', require('./stories'));
router.use('/chapters', require('./chapters'));
router.use('/categories', require('./categories'));
router.use('/authors', require('./authors'));
router.use('/slides', require('./slides'));
router.use('/missions', require('./missions'));

// Route public cho user
router.get('/public/users/slug/:slug', auth.optional, userController.getBySlug);
router.get('/public/users/slug-only/:id', userController.getSlugById);

// Các route cần xác thực
router.use('/users', require('./users'));
router.use('/purchased-stories', auth, require('./purchasedStories'));
router.use('/stories-reading', auth, require('./storiesReading'));
router.use('/transactions', auth, require('./transactions'));
router.use('/bookmarks', auth, require('./bookmarks'));
router.use('/stars', auth, require('./stars'));
// Route attendance không cần middleware auth ở đây vì đã có authenticateToken trong route
router.use('/attendance', require('./attendance'));
// Route comments
router.use('/comments', require('./commentRoutes'));
// Admin routes
router.use('/admin/coins', auth, require('./coins'));
router.use('/admin/users', auth, require('./admin/users'));

module.exports = router;
