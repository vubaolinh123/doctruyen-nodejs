require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const setupAttendanceCron = require('./cron/attendanceCron');
const mongoose = require('mongoose');
const apiLogger = require('./middleware/apiLogger');

const app = express();
console.log('🚀 Server starting...');
connectDB();

app.use(express.json());
app.use(cors({
    origin: '*', // *
    credentials: true,
  }));

// Log all requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

app.use(apiLogger);

app.use('/api/auth', authRoutes);
app.use('/api', routes);
app.use(errorHandler);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🌍 Server running on port ${PORT}`);
  console.log(`📍 API endpoint: http://localhost:${PORT}/api`);

  // Khởi động cron job cho điểm danh
  setupAttendanceCron();
  console.log('📅 Attendance cron job scheduled');
});

// Thêm vào cuối file, trước app.listen
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Bắt uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection:', err);
  process.exit(1);
});

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`📍 API endpoint: http://localhost:${PORT}/api`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });
