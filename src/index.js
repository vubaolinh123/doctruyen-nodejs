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

// Configure Express body parsers with proper size limits for file uploads
app.use(express.json({ limit: '50mb' })); // Increase JSON limit
app.use(express.urlencoded({
  limit: '50mb',
  extended: true,
  parameterLimit: 50000
})); // Support large form data
app.use(express.raw({
  limit: '50mb',
  type: ['application/octet-stream']
  // IMPORTANT: Do NOT include 'multipart/form-data' here as it conflicts with multer
  // Multer needs to handle multipart data directly, not Express raw middleware
})); // Support raw binary data

// Centralized CORS Configuration
// Apply CORS in both development and production environments
if (process.env.NODE_ENV === 'production') {
  console.log('\x1b[36m%s\x1b[0m', `[${startupTimestamp}] ✓ Applying CORS for production environment`);
  console.log('\x1b[36m%s\x1b[0m', `[${startupTimestamp}] ✓ Allowed origin: ${process.env.FRONTEND_URL}`);

  // Validate FRONTEND_URL environment variable
  if (!process.env.FRONTEND_URL) {
    console.error('\x1b[31m%s\x1b[0m', `[${startupTimestamp}] ✗ ERROR: FRONTEND_URL environment variable is not set!`);
    process.exit(1);
  }

  app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'Pragma',
      'Expires',
      'X-File-Name',
      'X-Admin-Request', // ADMIN FIX: Allow admin request header
      // REAL-TIME COMMENT FIX: Add cache-control headers for no-cache functionality
      'If-None-Match',
      'If-Modified-Since'
    ],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
    maxAge: 86400 // Cache preflight for 24 hours
  }));
} else {
  console.log('\x1b[36m%s\x1b[0m', `[${startupTimestamp}] ✓ Applying CORS for development environment`);
  console.log('\x1b[36m%s\x1b[0m', `[${startupTimestamp}] ✓ Allowed origins: localhost:3000, localhost:3001`);

  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'https://localhost:3000', 'https://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'Pragma',
      'Expires',
      'X-File-Name',
      'X-Admin-Request', // ADMIN FIX: Allow admin request header
      // REAL-TIME COMMENT FIX: Add cache-control headers for no-cache functionality
      'If-None-Match',
      'If-Modified-Since'
    ],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    optionsSuccessStatus: 200,
    maxAge: 86400
  }));
}

// Debug middleware for file upload requests
app.use('/api/images/upload', (req, res, next) => {
  const debugTimestamp = getLogTimestamp();
  console.log('\x1b[35m%s\x1b[0m', `[${debugTimestamp}] 🔍 File upload request debug:`);
  console.log('\x1b[35m%s\x1b[0m', `[${debugTimestamp}] - Method: ${req.method}`);
  console.log('\x1b[35m%s\x1b[0m', `[${debugTimestamp}] - Origin: ${req.headers.origin}`);
  console.log('\x1b[35m%s\x1b[0m', `[${debugTimestamp}] - Content-Type: ${req.headers['content-type']}`);
  console.log('\x1b[35m%s\x1b[0m', `[${debugTimestamp}] - Content-Length: ${req.headers['content-length']}`);
  console.log('\x1b[35m%s\x1b[0m', `[${debugTimestamp}] - Authorization: ${req.headers.authorization ? 'Present' : 'Missing'}`);
  next();
});

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
