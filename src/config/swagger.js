const swaggerJsdoc = require('swagger-jsdoc');
const { storySchemas, storyPaths } = require('./swagger/stories');
const { chapterSchemas, chapterPaths } = require('./swagger/chapters');

// Tổng hợp tất cả các schemas
const schemas = {
  ...storySchemas,
  ...chapterSchemas,
  Error: {
    type: 'object',
    properties: {
      error: {
        type: 'string',
        description: 'Thông báo lỗi',
        example: 'Không tìm thấy dữ liệu yêu cầu',
      },
    },
  },
};

// Tổng hợp tất cả các paths
const paths = {
  ...storyPaths,
  ...chapterPaths,
};

// Cấu hình Swagger
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Truyện - Hệ thống Đọc Truyện',
      version: '1.0.0',
      description: 'Tài liệu API cho hệ thống Đọc Truyện',
      contact: {
        name: 'Admin',
        email: 'admin@example.com'
      },
    },
    servers: [
      {
        url: 'http://localhost:8000',
        description: 'Server phát triển',
      },
      {
        url: 'https://api.yourdomain.com',
        description: 'Server production',
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: schemas,
    },
    paths: paths,
    tags: [
      {
        name: 'Truyện',
        description: 'Các API liên quan đến quản lý truyện',
      },
      {
        name: 'Chương',
        description: 'Các API liên quan đến quản lý chương truyện',
      },
      {
        name: 'Tác giả',
        description: 'Các API liên quan đến quản lý tác giả',
      },
      {
        name: 'Thể loại',
        description: 'Các API liên quan đến quản lý thể loại',
      },
      {
        name: 'Người dùng',
        description: 'Các API liên quan đến quản lý người dùng',
      },
      {
        name: 'Đánh giá',
        description: 'Các API liên quan đến đánh giá truyện',
      },
      {
        name: 'Bình luận',
        description: 'Các API liên quan đến bình luận',
      },
      {
        name: 'Xác thực',
        description: 'Các API liên quan đến xác thực và phân quyền',
      },
    ],
  },
  apis: [], // Không cần quét API nữa vì chúng ta đã định nghĩa trực tiếp
};

const specs = swaggerJsdoc(options);

module.exports = specs; 