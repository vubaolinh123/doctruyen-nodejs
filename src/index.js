require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Thiết lập timezone trước khi import bất kỳ module nào khác
process.env.TZ = 'Asia/Ho_Chi_Minh';

const express = require('express');
const connectDB = require('./config/db');
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const setupAttendanceCron = require('./cron/attendanceCron');
const cron = require('./cron');
const RankingInitializer = require('./services/ranking/rankingInitializer');
const apiLogger = require('./middleware/apiLogger');
const requestLogger = require('./middleware/requestLogger');
const swaggerUI = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const { getLogTimestamp } = require('./utils/timezone');

const app = express();

// Log thông tin môi trường với timestamp
const startupTimestamp = getLogTimestamp();
console.log('\x1b[33m%s\x1b[0m', '-------------------------------------');
console.log('\x1b[33m%s\x1b[0m', '🚀 KHỞI ĐỘNG SERVER API TRUYỆN HAY');
console.log('\x1b[33m%s\x1b[0m', '-------------------------------------');
console.log('\x1b[36m%s\x1b[0m', `[${startupTimestamp}] ✓ Môi trường: ${process.env.NODE_ENV || 'development'}`);
console.log('\x1b[36m%s\x1b[0m', `[${startupTimestamp}] ✓ Timezone: ${process.env.TZ}`);
console.log('\x1b[33m%s\x1b[0m', '-------------------------------------');

app.use(express.json());
app.use(cors({
    origin: '*', // *
    credentials: true,
  }));

// Log incoming requests và responses
app.use(requestLogger);
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
  const errorTimestamp = getLogTimestamp();
  console.error('\x1b[36m%s\x1b[0m \x1b[31m%s\x1b[0m', `[${errorTimestamp}]`, '✗ Uncaught Exception:');
  console.error('\x1b[36m%s\x1b[0m \x1b[31m%s\x1b[0m', `[${errorTimestamp}]`, err.stack || err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  const errorTimestamp = getLogTimestamp();
  console.error('\x1b[36m%s\x1b[0m \x1b[31m%s\x1b[0m', `[${errorTimestamp}]`, '✗ Unhandled Promise Rejection:');
  console.error('\x1b[36m%s\x1b[0m \x1b[31m%s\x1b[0m', `[${errorTimestamp}]`, err.stack || err);
  process.exit(1);
});

const PORT = process.env.PORT || 8000;

// Kết nối MongoDB và khởi động server
connectDB()
  .then((connected) => {
    if (connected) {
      // Khởi động server sau khi kết nối MongoDB thành công
      const server = app.listen(PORT, () => {
        const serverUrl = `http://localhost:${PORT}`;
        const serverStartTimestamp = getLogTimestamp();

        console.log('\x1b[32m%s\x1b[0m', `[${serverStartTimestamp}] ✓ Server đang chạy!`);
        console.log('\x1b[36m%s\x1b[0m', `[${serverStartTimestamp}] ✓ Server URL: ${serverUrl}`);
        console.log('\x1b[36m%s\x1b[0m', `[${serverStartTimestamp}] ✓ API Docs: ${serverUrl}/api-docs`);
        console.log('\x1b[36m%s\x1b[0m', `[${serverStartTimestamp}] ✓ Port: ${PORT}`);
        console.log('\x1b[33m%s\x1b[0m', '-------------------------------------');

        // Khởi tạo system settings
        const SystemSettings = require('./models/systemSettings');
        SystemSettings.initializeDefaults().catch(err => {
          const errorTimestamp = getLogTimestamp();
          console.error(`\x1b[36m[${errorTimestamp}]\x1b[0m \x1b[31m[ERROR]\x1b[0m Error initializing system settings:`, err);
        });

        // Khởi tạo temporary image system
        const { initTempImageSystem } = require('./controllers/image/tempImageController');
        initTempImageSystem().catch(err => {
          const errorTimestamp = getLogTimestamp();
          console.error(`\x1b[36m[${errorTimestamp}]\x1b[0m \x1b[31m[ERROR]\x1b[0m Error initializing temp image system:`, err);
        });

        // Khởi tạo dữ liệu ranking khi server startup
        RankingInitializer.initializeOnStartup()
          .then(result => {
            const initTimestamp = getLogTimestamp();
            if (result.success) {
              if (result.created) {
                console.log(`\x1b[36m[${initTimestamp}]\x1b[0m \x1b[32m[SUCCESS]\x1b[0m Ranking initialization completed`);
              } else {
                console.log(`\x1b[36m[${initTimestamp}]\x1b[0m \x1b[32m[INFO]\x1b[0m ${result.message}`);
              }
            } else {
              console.error(`\x1b[36m[${initTimestamp}]\x1b[0m \x1b[31m[ERROR]\x1b[0m Ranking initialization failed:`, result.error);
            }
          })
          .catch(err => {
            const errorTimestamp = getLogTimestamp();
            console.error(`\x1b[36m[${errorTimestamp}]\x1b[0m \x1b[31m[ERROR]\x1b[0m Error during ranking initialization:`, err);
          });

        // Khởi động cron job cho điểm danh
        setupAttendanceCron();

        // Khởi động cron job cho xếp hạng
        cron.startAllCrons();
      });
    } else {
      const errorTimestamp = getLogTimestamp();
      console.error('\x1b[36m%s\x1b[0m \x1b[31m%s\x1b[0m', `[${errorTimestamp}]`, '✗ Không thể khởi động server do lỗi kết nối MongoDB');
      process.exit(1);
    }
  })
  .catch((error) => {
    const errorTimestamp = getLogTimestamp();
    console.error('\x1b[36m%s\x1b[0m \x1b[31m%s\x1b[0m', `[${errorTimestamp}]`, `✗ Lỗi không xác định: ${error.message}`);
    process.exit(1);
  });
