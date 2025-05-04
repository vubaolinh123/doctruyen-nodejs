const express = require('express');
const router = express.Router();

// Đăng ký các route
router.use('/', require('./crud'));
router.use('/story', require('./story'));

module.exports = router;
