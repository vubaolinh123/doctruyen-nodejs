/**
 * Tài liệu Swagger cho phần Truyện
 * Bao gồm tất cả API và model liên quan đến Truyện
 */

// Định nghĩa model Story
const storySchemas = {
  // Model chính
  Story: {
    type: 'object',
    required: ['name'],
    properties: {
      _id: {
        type: 'string',
        description: 'ID của truyện',
        example: '60c72b2f9b1c8a3a94b5e5f1',
      },
      slug: {
        type: 'string',
        description: 'Slug của truyện',
        example: 'truyen-hay-nhat',
      },
      image: {
        type: 'string',
        description: 'Đường dẫn hình ảnh của truyện',
        example: 'https://example.com/images/truyen-1.jpg',
      },
      banner: {
        type: 'string',
        description: 'Đường dẫn banner của truyện',
        example: 'https://example.com/banners/truyen-1.jpg',
      },
      name: {
        type: 'string',
        description: 'Tên truyện',
        example: 'Truyện Hay Nhất',
      },
      desc: {
        type: 'string',
        description: 'Mô tả truyện',
        example: 'Đây là một truyện hay nhất hiện nay...',
      },
      author_id: {
        type: 'array',
        items: {
          type: 'string',
          description: 'ID của tác giả',
          example: '60c72b2f9b1c8a3a94b5e5f2',
        },
      },
      categories: {
        type: 'array',
        items: {
          type: 'string',
          description: 'ID của thể loại',
          example: '60c72b2f9b1c8a3a94b5e5f3',
        },
      },
      stars: {
        type: 'number',
        description: 'Đánh giá sao trung bình của truyện',
        example: 8.5,
      },
      count_star: {
        type: 'number',
        description: 'Số lượng đánh giá sao',
        example: 150,
      },
      views: {
        type: 'number',
        description: 'Số lượt xem',
        example: 1500,
      },
      is_full: {
        type: 'boolean',
        description: 'Truyện đã hoàn thành hay chưa',
        example: false,
      },
      is_hot: {
        type: 'boolean',
        description: 'Truyện có phải là hot hay không',
        example: true,
      },
      is_new: {
        type: 'boolean',
        description: 'Truyện có phải là mới hay không',
        example: true,
      },
      show_ads: {
        type: 'boolean',
        description: 'Hiển thị quảng cáo trong truyện hay không',
        example: false,
      },
      hot_day: {
        type: 'boolean',
        description: 'Truyện có nổi bật trong ngày hay không',
        example: true,
      },
      hot_month: {
        type: 'boolean',
        description: 'Truyện có nổi bật trong tháng hay không',
        example: false,
      },
      hot_all_time: {
        type: 'boolean',
        description: 'Truyện có nổi bật mọi thời điểm hay không',
        example: false,
      },
      status: {
        type: 'boolean',
        description: 'Trạng thái hoạt động của truyện',
        example: true,
      },
      chapter_count: {
        type: 'number',
        description: 'Số lượng chương của truyện',
        example: 25,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Thời gian tạo truyện',
        example: '2023-06-15T10:00:00Z',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Thời gian cập nhật truyện gần nhất',
        example: '2023-06-20T15:30:00Z',
      },
    },
  },
  
  // Schema dùng cho input khi tạo mới hoặc cập nhật
  StoryInput: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        description: 'Tên truyện',
        example: 'Truyện Hay Nhất',
      },
      image: {
        type: 'string',
        description: 'Đường dẫn hình ảnh của truyện',
        example: 'https://example.com/images/truyen-1.jpg',
      },
      banner: {
        type: 'string',
        description: 'Đường dẫn banner của truyện',
        example: 'https://example.com/banners/truyen-1.jpg',
      },
      desc: {
        type: 'string',
        description: 'Mô tả truyện',
        example: 'Đây là một truyện hay nhất hiện nay...',
      },
      author_id: {
        type: 'array',
        items: {
          type: 'string',
          description: 'ID của tác giả',
          example: '60c72b2f9b1c8a3a94b5e5f2',
        },
      },
      categories: {
        type: 'array',
        items: {
          type: 'string',
          description: 'ID của thể loại',
          example: '60c72b2f9b1c8a3a94b5e5f3',
        },
      },
      is_full: {
        type: 'boolean',
        description: 'Truyện đã hoàn thành hay chưa',
        example: false,
      },
      is_hot: {
        type: 'boolean',
        description: 'Truyện có phải là hot hay không',
        example: true,
      },
      is_new: {
        type: 'boolean',
        description: 'Truyện có phải là mới hay không',
        example: true,
      },
      show_ads: {
        type: 'boolean',
        description: 'Hiển thị quảng cáo trong truyện hay không',
        example: false,
      },
      hot_day: {
        type: 'boolean',
        description: 'Truyện có nổi bật trong ngày hay không',
        example: true,
      },
      hot_month: {
        type: 'boolean',
        description: 'Truyện có nổi bật trong tháng hay không',
        example: false,
      },
      hot_all_time: {
        type: 'boolean',
        description: 'Truyện có nổi bật mọi thời điểm hay không',
        example: false,
      },
      status: {
        type: 'boolean',
        description: 'Trạng thái hoạt động của truyện',
        example: true,
      },
    },
  },
  
  // Schema cho response phân trang
  StoriesPagination: {
    type: 'object',
    properties: {
      stories: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Story',
        },
      },
      totalStories: {
        type: 'integer',
        description: 'Tổng số truyện',
        example: 100,
      },
      totalPages: {
        type: 'integer',
        description: 'Tổng số trang',
        example: 10,
      },
      currentPage: {
        type: 'integer',
        description: 'Trang hiện tại',
        example: 1,
      },
    },
  },
};

// Các định nghĩa API path
const storyPaths = {
  // [1] GET /api/stories - Lấy danh sách tất cả truyện
  '/api/stories': {
    get: {
      tags: ['Truyện'],
      summary: 'Lấy danh sách tất cả truyện',
      description: 'Trả về danh sách tất cả truyện có thể phân trang và lọc',
      parameters: [
        {
          in: 'query',
          name: 'page',
          schema: {
            type: 'integer',
            default: 1,
          },
          description: 'Số trang hiện tại',
        },
        {
          in: 'query',
          name: 'limit',
          schema: {
            type: 'integer',
            default: 10,
          },
          description: 'Số lượng truyện trên mỗi trang',
        },
        {
          in: 'query',
          name: 'sort',
          schema: {
            type: 'string',
            enum: ['latest', 'views', 'stars'],
            default: 'latest',
          },
          description: 'Sắp xếp truyện theo tiêu chí',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/StoriesPagination',
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    
    // [2] POST /api/stories - Tạo truyện mới
    post: {
      tags: ['Truyện'],
      summary: 'Tạo truyện mới',
      description: 'Tạo một truyện mới với thông tin được cung cấp',
      security: [
        {
          bearerAuth: [],
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/StoryInput',
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Tạo thành công',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Story',
              },
            },
          },
        },
        400: {
          description: 'Dữ liệu không hợp lệ',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        401: {
          description: 'Không có quyền truy cập',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [3] GET /api/stories/hot - Lấy danh sách truyện hot
  '/api/stories/hot': {
    get: {
      tags: ['Truyện'],
      summary: 'Lấy danh sách truyện hot',
      description: 'Trả về danh sách truyện được đánh dấu là hot',
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Story',
                },
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [4] GET /api/stories/top-rated - Lấy danh sách truyện được đánh giá cao
  '/api/stories/top-rated': {
    get: {
      tags: ['Truyện'],
      summary: 'Lấy danh sách truyện được đánh giá cao',
      description: 'Trả về danh sách truyện có đánh giá sao cao nhất',
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Story',
                },
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [5] GET /api/stories/recent - Lấy danh sách truyện mới cập nhật
  '/api/stories/recent': {
    get: {
      tags: ['Truyện'],
      summary: 'Lấy danh sách truyện mới cập nhật',
      description: 'Trả về danh sách truyện được cập nhật gần đây',
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Story',
                },
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [6] GET /api/stories/new - Lấy danh sách truyện mới
  '/api/stories/new': {
    get: {
      tags: ['Truyện'],
      summary: 'Lấy danh sách truyện mới',
      description: 'Trả về danh sách truyện mới được thêm vào hệ thống',
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Story',
                },
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [7] GET /api/stories/suggest - Lấy danh sách truyện đề xuất
  '/api/stories/suggest': {
    get: {
      tags: ['Truyện'],
      summary: 'Lấy danh sách truyện đề xuất',
      description: 'Trả về danh sách truyện được đề xuất dựa trên các tiêu chí',
      parameters: [
        {
          in: 'query',
          name: 'categories',
          schema: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          description: 'Danh sách ID thể loại để đề xuất',
        },
        {
          in: 'query',
          name: 'excludeId',
          schema: {
            type: 'string',
          },
          description: 'ID truyện cần loại trừ khỏi kết quả đề xuất',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Story',
                },
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [8] GET /api/stories/category/{categoryId} - Lấy danh sách truyện theo thể loại
  '/api/stories/category/{categoryId}': {
    get: {
      tags: ['Truyện'],
      summary: 'Lấy danh sách truyện theo thể loại',
      description: 'Trả về danh sách truyện thuộc một thể loại cụ thể',
      parameters: [
        {
          in: 'path',
          name: 'categoryId',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'ID của thể loại',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Story',
                },
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [9] GET /api/stories/author/{authorId} - Lấy danh sách truyện theo tác giả
  '/api/stories/author/{authorId}': {
    get: {
      tags: ['Truyện'],
      summary: 'Lấy danh sách truyện theo tác giả',
      description: 'Trả về danh sách truyện của một tác giả cụ thể',
      parameters: [
        {
          in: 'path',
          name: 'authorId',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'ID của tác giả',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Story',
                },
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [10] GET /api/stories/search - Tìm kiếm truyện
  '/api/stories/search': {
    get: {
      tags: ['Truyện'],
      summary: 'Tìm kiếm truyện',
      description: 'Tìm kiếm truyện theo từ khóa',
      parameters: [
        {
          in: 'query',
          name: 'q',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'Từ khóa tìm kiếm',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Story',
                },
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [11] GET /api/stories/slug/{slug} - Lấy thông tin truyện theo slug
  '/api/stories/slug/{slug}': {
    get: {
      tags: ['Truyện'],
      summary: 'Lấy thông tin truyện theo slug',
      description: 'Trả về thông tin chi tiết của truyện dựa trên slug',
      parameters: [
        {
          in: 'path',
          name: 'slug',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'Slug của truyện',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Story',
              },
            },
          },
        },
        404: {
          description: 'Không tìm thấy truyện',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [12] POST /api/stories/increment-views/{slug} - Tăng lượt xem cho truyện
  '/api/stories/increment-views/{slug}': {
    post: {
      tags: ['Truyện'],
      summary: 'Tăng lượt xem cho truyện',
      description: 'Tăng lượt xem cho truyện dựa trên slug',
      parameters: [
        {
          in: 'path',
          name: 'slug',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'Slug của truyện',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true,
                  },
                  message: {
                    type: 'string',
                    example: 'View count incremented successfully',
                  },
                  views: {
                    type: 'number',
                    example: 1501,
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Yêu cầu không hợp lệ',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  
  // [13] GET /api/stories/{id} - Lấy thông tin truyện theo ID
  '/api/stories/{id}': {
    get: {
      tags: ['Truyện'],
      summary: 'Lấy thông tin truyện theo ID',
      description: 'Trả về thông tin chi tiết của truyện dựa trên ID',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'ID của truyện',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Story',
              },
            },
          },
        },
        404: {
          description: 'Không tìm thấy truyện',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    
    // [14] PUT /api/stories/{id} - Cập nhật thông tin truyện
    put: {
      tags: ['Truyện'],
      summary: 'Cập nhật thông tin truyện',
      description: 'Cập nhật thông tin của truyện dựa trên ID',
      security: [
        {
          bearerAuth: [],
        },
      ],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'ID của truyện',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/StoryInput',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Cập nhật thành công',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Story',
              },
            },
          },
        },
        400: {
          description: 'Dữ liệu không hợp lệ',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        401: {
          description: 'Không có quyền truy cập',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        404: {
          description: 'Không tìm thấy truyện',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    
    // [15] DELETE /api/stories/{id} - Xóa truyện
    delete: {
      tags: ['Truyện'],
      summary: 'Xóa truyện',
      description: 'Xóa truyện dựa trên ID',
      security: [
        {
          bearerAuth: [],
        },
      ],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'ID của truyện',
        },
      ],
      responses: {
        200: {
          description: 'Xóa thành công',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Deleted successfully',
                  },
                },
              },
            },
          },
        },
        401: {
          description: 'Không có quyền truy cập',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        404: {
          description: 'Không tìm thấy truyện',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        500: {
          description: 'Lỗi server',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
};

module.exports = {
  storySchemas,
  storyPaths,
}; 