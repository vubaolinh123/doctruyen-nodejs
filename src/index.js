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
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  process.exit(1);
});

const PORT = process.env.PORT || 8000;

// Kết nối MongoDB và khởi động server
connectDB()
  .then(() => {
    // Khởi động server sau khi kết nối MongoDB thành công
    app.listen(PORT, () => {
      // Khởi động cron job cho điểm danh
      setupAttendanceCron();

      // Khởi động cron job cho xếp hạng
      cron.startAllCrons();
    });
  })
  .catch((error) => {
    process.exit(1);
  });
