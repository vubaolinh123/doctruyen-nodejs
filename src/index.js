require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const setupAttendanceCron = require('./cron/attendanceCron');
const cron = require('./cron');
const apiLogger = require('./middleware/apiLogger');
const swaggerUI = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

const app = express();

// Thiết lập timezone cho Việt Nam
process.env.TZ = 'Asia/Ho_Chi_Minh';

// Log thông tin môi trường
console.log('\x1b[33m%s\x1b[0m', '-------------------------------------');
console.log('\x1b[33m%s\x1b[0m', '🚀 KHỞI ĐỘNG SERVER API TRUYỆN HAY');
console.log('\x1b[33m%s\x1b[0m', '-------------------------------------');
console.log('\x1b[36m%s\x1b[0m', `✓ Môi trường: ${process.env.NODE_ENV || 'development'}`);
console.log('\x1b[36m%s\x1b[0m', `✓ Timezone: ${process.env.TZ}`);
console.log('\x1b[33m%s\x1b[0m', '-------------------------------------');

app.use(express.json());
app.use(cors({
    origin: '*', // *
    credentials: true,
  }));

// Log all requests
app.use((req, res, next) => {
  next();
});

app.use(apiLogger);

// Cấu hình Swagger UI
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'API Truyện - Tài liệu',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    docExpansion: 'none',
    persistAuthorization: true,
    filter: true,
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api', routes);
app.use(errorHandler);

// Global error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal server error' });
});

// Bắt uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('\x1b[31m%s\x1b[0m', '✗ Uncaught Exception:');
  console.error('\x1b[31m%s\x1b[0m', err.stack || err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('\x1b[31m%s\x1b[0m', '✗ Unhandled Promise Rejection:');
  console.error('\x1b[31m%s\x1b[0m', err.stack || err);
  process.exit(1);
});

const PORT = process.env.PORT || 8000;

// Kết nối MongoDB và khởi động server
connectDB()
  .then((connected) => {
    if (connected) {
      // Khởi động server sau khi kết nối MongoDB thành công
      const server = app.listen(PORT, () => {
        const serverAddress = server.address();
        const serverUrl = `http://localhost:${serverAddress.port}`;

        console.log('\x1b[32m%s\x1b[0m', '✓ Server đang chạy!');
        console.log('\x1b[36m%s\x1b[0m', `✓ Server URL: ${serverUrl}`);
        console.log('\x1b[36m%s\x1b[0m', `✓ API Docs: ${serverUrl}/api-docs`);
        console.log('\x1b[36m%s\x1b[0m', `✓ Port: ${PORT}`);
        console.log('\x1b[33m%s\x1b[0m', '-------------------------------------');

        // Khởi động cron job cho điểm danh
        setupAttendanceCron();

        // Khởi động cron job cho xếp hạng
        cron.startAllCrons();
      });
    } else {
      console.error('\x1b[31m%s\x1b[0m', '✗ Không thể khởi động server do lỗi kết nối MongoDB');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\x1b[31m%s\x1b[0m', `✗ Lỗi không xác định: ${error.message}`);
    process.exit(1);
  });
