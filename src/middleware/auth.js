const jwt = require('jsonwebtoken');

// Middleware để xác thực token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access Denied. No Token Provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Lưu thông tin người dùng vào req.user
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid Token' });
  }
};

// Export middleware mặc định cho các route cũ
module.exports = (req, res, next) => {
  authenticateToken(req, res, next);
};

// Export authenticateToken cho các route mới
module.exports.authenticateToken = authenticateToken;