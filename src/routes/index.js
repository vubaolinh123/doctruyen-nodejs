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
router.use('/seo-config', require('./seoConfig'));
router.use('/cache-config', require('./cacheConfig'));
router.use('/rankings', require('./rankings'));
router.use('/story-stats', require('./storyStats'));

// Route public cho user
router.get('/public/users/slug/:slug', auth.optional, userController.getBySlug);
router.get('/public/users/slug-only/:id', userController.getSlugById);

// Các route cần xác thực
router.use('/users', require('./users'));
router.use('/purchased-stories', auth, require('./purchasedStories'));
router.use('/stories-reading', auth, require('./storiesReading'));
router.use('/transactions', auth, require('./transactions'));

// Route attendance không cần middleware auth ở đây vì đã có authenticateToken trong route
router.use('/attendance', require('./attendance'));
// Route comments
router.use('/comments', require('./commentRoutes'));
// Route notifications
router.use('/notifications', require('./notificationRoutes'));
// Image upload routes
router.use('/images', require('./images'));
// Admin routes
router.use('/admin/coins', auth, require('./coins'));
router.use('/admin/users', auth, require('./admin/users'));
router.use('/admin/permission-templates', require('./admin/permissionTemplates'));
router.use('/admin/attendance-rewards', require('./admin/attendanceRewards'));
router.use('/admin/comments', require('./admin/commentModeration'));
router.use('/admin/comments/reported', require('./admin/reportedComments'));

module.exports = router;
