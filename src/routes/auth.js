const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/oauth-login', controller.oath);
router.get("/me", controller.getMe);

module.exports = router;