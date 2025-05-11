const express = require('express');
const router = express.Router();
const controller = require('../controllers/transaction');
const { authenticateToken } = require('../middleware/auth');

// Middleware để log request
const logRequest = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Query:', req.query);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
};

// Áp dụng middleware log request cho tất cả các route
router.use(logRequest);

// Áp dụng middleware xác thực cho tất cả các route
router.use(authenticateToken);

// Các route CRUD cơ bản
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

// Các route đặc biệt
router.get('/stats/user/:userId', controller.getStatsByUser);
router.get('/stats/chart', controller.getChartData);
router.get('/stats/admin', controller.getAdminStats);

module.exports = router;
