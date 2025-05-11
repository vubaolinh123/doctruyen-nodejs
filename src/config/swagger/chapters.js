/**
 * Tài liệu Swagger cho phần Chương truyện
 * Bao gồm tất cả API và model liên quan đến Chương truyện
 */

// Định nghĩa model Chapter
const chapterSchemas = {
  // Model chính
  Chapter: {
    type: 'object',
    required: ['title', 'story_id'],
    properties: {
      _id: {
        type: 'string',
        description: 'ID của chương',
        example: '60c72b2f9b1c8a3a94b5e5f1',
      },
      slug: {
        type: 'string',
        description: 'Slug của chương',
        example: 'chuong-1-mo-dau',
      },
      title: {
        type: 'string',
        description: 'Tiêu đề chương',
        example: 'Chương 1: Mở đầu',
      },
      chapter_number: {
        type: 'number',
        description: 'Số chương',
        example: 1,
      },
      content: {
        type: 'string',
        description: 'Nội dung chương',
        example: 'Nội dung chi tiết của chương...',
      },
      story_id: {
        type: 'string',
        description: 'ID của truyện mà chương thuộc về',
        example: '60c72b2f9b1c8a3a94b5e5f2',
      },
      views: {
        type: 'number',
        description: 'Số lượt xem của chương',
        example: 150,
      },
      status: {
        type: 'boolean',
        description: 'Trạng thái hoạt động của chương',
        example: true,
      },
      is_vip: {
        type: 'boolean',
        description: 'Chương có phải là VIP hay không',
        example: false,
      },
      price: {
        type: 'number',
        description: 'Giá của chương nếu là VIP',
        example: 10,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Thời gian tạo chương',
        example: '2023-06-15T10:00:00Z',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Thời gian cập nhật chương gần nhất',
        example: '2023-06-20T15:30:00Z',
      },
    },
  },
  
  // Schema dùng cho input khi tạo mới hoặc cập nhật
  ChapterInput: {
    type: 'object',
    required: ['title', 'story_id', 'content'],
    properties: {
      title: {
        type: 'string',
        description: 'Tiêu đề chương',
        example: 'Chương 1: Mở đầu',
      },
      chapter_number: {
        type: 'number',
        description: 'Số chương',
        example: 1,
      },
      content: {
        type: 'string',
        description: 'Nội dung chương',
        example: 'Nội dung chi tiết của chương...',
      },
      story_id: {
        type: 'string',
        description: 'ID của truyện mà chương thuộc về',
        example: '60c72b2f9b1c8a3a94b5e5f2',
      },
      status: {
        type: 'boolean',
        description: 'Trạng thái hoạt động của chương',
        example: true,
      },
      is_vip: {
        type: 'boolean',
        description: 'Chương có phải là VIP hay không',
        example: false,
      },
      price: {
        type: 'number',
        description: 'Giá của chương nếu là VIP',
        example: 10,
      },
    },
  },
  
  // Schema cho response phân trang
  ChaptersPagination: {
    type: 'object',
    properties: {
      chapters: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/Chapter',
        },
      },
      totalChapters: {
        type: 'integer',
        description: 'Tổng số chương',
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
const chapterPaths = {
  // [1] GET /api/chapters - Lấy danh sách tất cả chương
  '/api/chapters': {
    get: {
      tags: ['Chương'],
      summary: 'Lấy danh sách tất cả chương',
      description: 'Trả về danh sách tất cả chương có thể phân trang và lọc',
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
          description: 'Số lượng chương trên mỗi trang',
        },
        {
          in: 'query',
          name: 'story_id',
          schema: {
            type: 'string',
          },
          description: 'ID của truyện để lọc chương',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChaptersPagination',
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
    
    // [2] POST /api/chapters - Tạo chương mới
    post: {
      tags: ['Chương'],
      summary: 'Tạo chương mới',
      description: 'Tạo một chương mới với thông tin được cung cấp',
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
              $ref: '#/components/schemas/ChapterInput',
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
                $ref: '#/components/schemas/Chapter',
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
  
  // [3] GET /api/chapters/story/{storyId} - Lấy danh sách chương theo truyện
  '/api/chapters/story/{storyId}': {
    get: {
      tags: ['Chương'],
      summary: 'Lấy danh sách chương theo truyện',
      description: 'Trả về danh sách tất cả chương của một truyện cụ thể',
      parameters: [
        {
          in: 'path',
          name: 'storyId',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'ID của truyện',
        },
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
          description: 'Số lượng chương trên mỗi trang',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChaptersPagination',
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
  
  // [4] GET /api/chapters/slug/{slug} - Lấy chương theo slug
  '/api/chapters/slug/{slug}': {
    get: {
      tags: ['Chương'],
      summary: 'Lấy chương theo slug',
      description: 'Trả về thông tin chi tiết của một chương dựa trên slug',
      parameters: [
        {
          in: 'path',
          name: 'slug',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'Slug của chương',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Chapter',
              },
            },
          },
        },
        404: {
          description: 'Không tìm thấy chương',
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
  
  // [5] POST /api/chapters/increment-views/{id} - Tăng lượt xem cho chương
  '/api/chapters/increment-views/{id}': {
    post: {
      tags: ['Chương'],
      summary: 'Tăng lượt xem cho chương',
      description: 'Tăng lượt xem cho chương dựa trên ID',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'ID của chương',
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
                    example: 151,
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
  
  // [6] GET /api/chapters/{id} - Lấy chương theo ID
  '/api/chapters/{id}': {
    get: {
      tags: ['Chương'],
      summary: 'Lấy chương theo ID',
      description: 'Trả về thông tin chi tiết của một chương dựa trên ID',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'ID của chương',
        },
      ],
      responses: {
        200: {
          description: 'Thành công',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Chapter',
              },
            },
          },
        },
        404: {
          description: 'Không tìm thấy chương',
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
    
    // [7] PUT /api/chapters/{id} - Cập nhật chương
    put: {
      tags: ['Chương'],
      summary: 'Cập nhật chương',
      description: 'Cập nhật thông tin của một chương dựa trên ID',
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
          description: 'ID của chương',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ChapterInput',
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
                $ref: '#/components/schemas/Chapter',
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
          description: 'Không tìm thấy chương',
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
    
    // [8] DELETE /api/chapters/{id} - Xóa chương
    delete: {
      tags: ['Chương'],
      summary: 'Xóa chương',
      description: 'Xóa một chương dựa trên ID',
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
          description: 'ID của chương',
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
          description: 'Không tìm thấy chương',
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
  chapterSchemas,
  chapterPaths,
}; 