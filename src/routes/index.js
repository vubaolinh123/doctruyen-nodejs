const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Các route công khai, không cần xác thực
router.use('/stories', require('./stories'));
router.use('/chapters', require('./chapters'));
router.use('/categories', require('./categories'));
router.use('/authors', require('./authors'));
router.use('/slides', require('./slides'));
router.use('/users', require('./public/users')); // Route mới để lấy thông tin người dùng theo slug

// Các route cần xác thực
router.use('/customers', auth, require('./customers'));
router.use('/purchased-stories', auth, require('./purchasedStories'));
router.use('/stories-reading', auth, require('./storiesReading'));
router.use('/transactions', auth, require('./transactions'));
router.use('/bookmarks', auth, require('./bookmarks'));
router.use('/stars', auth, require('./stars'));
// Route attendance không cần middleware auth ở đây vì đã có authenticateToken trong route
router.use('/attendance', require('./attendance'));
// Route admin
router.use('/admin', require('./admin'));

module.exports = router;
