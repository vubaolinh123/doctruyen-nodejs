const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.use('/authors', auth, require('./authors'));
// Categories route đã được cấu hình xác thực bên trong file route
router.use('/categories', require('./categories'));
router.use('/chapters', auth, require('./chapters'));
router.use('/customers', auth, require('./customers'));
router.use('/purchased-stories', auth, require('./purchasedStories'));
router.use('/slides', auth, require('./slides'));
router.use('/stories', auth, require('./stories'));
router.use('/stories-reading', auth, require('./storiesReading'));
router.use('/transactions', auth, require('./transactions'));
router.use('/bookmarks', auth, require('./bookmarks'));
router.use('/stars', auth, require('./stars'));
// Route attendance không cần middleware auth ở đây vì đã có authenticateToken trong route
router.use('/attendance', require('./attendance'));
// Route admin
router.use('/admin', require('./admin'));

module.exports = router;
