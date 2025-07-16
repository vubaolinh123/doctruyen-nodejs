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
// CRITICAL FIX: Add missing bookmarks router
router.use('/bookmarks', require('./bookmarks'));

// Route public cho user
router.get('/public/users/slug/:slug', auth.optional, userController.getBySlug);
router.get('/public/users/slug-only/:id', userController.getSlugById);

// Các route cần xác thực
router.use('/users', require('./users'));
router.use('/user', require('./user')); // Add singular user route for profile operations
router.use('/purchased-stories', auth, require('./purchasedStories'));
// CRITICAL FIX: Change to optional auth for reading progress compatibility
router.use('/stories-reading', require('./storiesReading'));
router.use('/transactions', auth, require('./transactions'));
router.use('/purchase', require('./purchase'));

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
router.use('/admin/authors', require('./admin/authors'));
router.use('/admin/permission-templates', require('./admin/permissionTemplates'));
router.use('/admin/attendance', require('./admin/attendanceRewards'));

// Author Panel routes - require author role authentication
router.use('/author-panel', require('./authorPanel'));
router.use('/admin/comments', require('./admin/commentModeration'));
router.use('/admin/missions', require('./admin/missions'));
router.use('/admin/chapters', auth, require('./admin/bulkChapters'));
router.use('/admin/comments/reported', require('./admin/reportedComments'));
// router.use('/admin/business-logic', require('./admin/businessLogic')); // Temporarily disabled

module.exports = router;
