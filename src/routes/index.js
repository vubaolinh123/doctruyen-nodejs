const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.use('/authors', auth, require('./authors'));
router.use('/categories', auth, require('./categories'));
router.use('/chapters', auth, require('./chapters'));
router.use('/customers', auth, require('./customers'));
router.use('/purchased-stories', auth, require('./purchasedStories'));
router.use('/slides', auth, require('./slides'));
router.use('/stories', auth, require('./stories'));
router.use('/stories-reading', auth, require('./storiesReading'));
router.use('/transactions', auth, require('./transactions'));
router.use('/bookmarks', auth, require('./bookmarks'));
router.use('/stars', auth, require('./stars'));

module.exports = router;
