# 🧪 API Testing Guide - Comment System

## 📋 Tổng Quan

Hướng dẫn toàn diện để test API endpoints của hệ thống comment mới với Jest và Supertest.

## 🚀 Cài Đặt và Chạy Tests

### Prerequisites
```bash
# Đảm bảo MongoDB đang chạy
# Đảm bảo có file .env với MONGODB_URI

# Cài đặt dependencies (đã cài)
npm install jest supertest --save-dev
```

### Chạy Tests

```bash
# Chạy tất cả tests
npm test

# Chạy tests với watch mode
npm run test:watch

# Chạy tests với coverage report
npm run test:coverage

# Chạy chỉ API tests
npm run test:api

# Chạy chỉ comment API tests
npm run test:comments
```

## 📊 Test Coverage

### Endpoints Được Test

#### **Public Endpoints (Không cần auth)**
- ✅ `GET /api/comments` - Lấy danh sách comments
- ✅ `GET /api/comments/search` - Tìm kiếm comments
- ✅ `GET /api/comments/stats` - Thống kê comments
- ✅ `GET /api/comments/hot` - Hot comments
- ✅ `GET /api/comments/:id/thread` - Comment thread

#### **Protected Endpoints (Cần auth)**
- ✅ `POST /api/comments` - Tạo comment mới
- ✅ `PUT /api/comments/:id` - Cập nhật comment
- ✅ `DELETE /api/comments/:id` - Xóa comment
- ✅ `POST /api/comments/:id/reaction` - Like/dislike
- ✅ `POST /api/comments/:id/flag` - Báo cáo comment

#### **Admin Endpoints (Cần admin auth)**
- ✅ `GET /api/admin/comments/queue` - Queue moderation
- ✅ `POST /api/admin/comments/:id/moderate` - Moderate comment
- ✅ `POST /api/admin/comments/bulk-moderate` - Bulk moderation
- ✅ `POST /api/admin/comments/auto-moderate` - Auto moderation
- ✅ `GET /api/admin/comments/stats` - Admin statistics

### Test Categories

#### **1. Authentication & Authorization**
- ✅ Token validation
- ✅ Role-based access control
- ✅ Admin permissions
- ✅ Expired/invalid tokens

#### **2. Input Validation**
- ✅ Required fields validation
- ✅ Data type validation
- ✅ Length constraints
- ✅ Format validation (ObjectId, etc.)

#### **3. Business Logic**
- ✅ Comment creation/update/delete
- ✅ Nested comments (replies)
- ✅ Like/dislike functionality
- ✅ Flag system
- ✅ Moderation workflow

#### **4. Error Handling**
- ✅ 400 Bad Request
- ✅ 401 Unauthorized
- ✅ 403 Forbidden
- ✅ 404 Not Found
- ✅ 500 Internal Server Error

#### **5. Performance**
- ✅ Response time < 500ms
- ✅ Concurrent requests handling
- ✅ Pagination efficiency

#### **6. Rate Limiting**
- ✅ Comment creation limits
- ✅ Reaction limits
- ✅ Flag limits

## 🔧 Test Structure

### File Organization
```
src/tests/
├── api/
│   └── commentAPI.test.js     # Main API tests
├── helpers/
│   └── authHelper.js          # Auth utilities
├── setup.js                   # Global test setup
└── ...
```

### Test Patterns

#### **Setup/Teardown Pattern**
```javascript
describe('Test Suite', () => {
  beforeAll(async () => {
    // Global setup
  });

  beforeEach(async () => {
    // Test-specific setup
  });

  afterEach(async () => {
    // Cleanup after each test
  });

  afterAll(async () => {
    // Global cleanup
  });
});
```

#### **Authentication Pattern**
```javascript
// User authentication
const response = await request(app)
  .post('/api/comments')
  .set('Authorization', `Bearer ${userToken}`)
  .send(data);

// Admin authentication
const response = await request(app)
  .get('/api/admin/comments/queue')
  .set('Authorization', `Bearer ${adminToken}`);
```

#### **Validation Pattern**
```javascript
test('Should validate required fields', async () => {
  const response = await request(app)
    .post('/api/comments')
    .set('Authorization', `Bearer ${userToken}`)
    .send({}) // Empty data
    .expect(400);

  expect(response.body.success).toBe(false);
  expect(response.body.errors).toBeDefined();
});
```

## 📈 Test Results Analysis

### Success Criteria
- ✅ All endpoints return correct status codes
- ✅ Response data structure matches API documentation
- ✅ Authentication/authorization works correctly
- ✅ Input validation catches invalid data
- ✅ Error messages are clear and helpful
- ✅ Performance meets requirements (< 500ms)

### Coverage Targets
- **Lines**: 70%+
- **Functions**: 70%+
- **Branches**: 70%+
- **Statements**: 70%+

## 🛠️ Test Utilities

### Authentication Helper
```javascript
const { tokenHelper, userFactory } = require('./helpers/authHelper');

// Generate test tokens
const userToken = tokenHelper.generateUserToken(userId);
const adminToken = tokenHelper.generateAdminToken(adminId);

// Create test users
const testUser = userFactory.createUser();
const testAdmin = userFactory.createAdmin();
```

### Database Helper
```javascript
const { dbHelper } = require('./helpers/authHelper');

// Clean test data
await dbHelper.cleanTestData();

// Create test data
const { testUser, testAdmin, testStory } = await dbHelper.createTestData();
```

## 🚨 Common Issues & Solutions

### **Issue 1: MongoDB Connection**
```bash
# Error: MongooseError: Operation `users.findOne()` buffering timed out
# Solution: Ensure MongoDB is running and MONGODB_URI is correct
```

### **Issue 2: JWT Secret**
```bash
# Error: JsonWebTokenError: secret or public key is required
# Solution: Set JWT_SECRET in .env or test environment
```

### **Issue 3: Rate Limiting**
```bash
# Error: Tests failing due to rate limits
# Solution: Use different test data or increase rate limits for testing
```

### **Issue 4: Test Data Cleanup**
```bash
# Error: Tests interfering with each other
# Solution: Proper cleanup in afterEach hooks
```

## 📊 Sample Test Output

```bash
 PASS  src/tests/api/commentAPI.test.js (25.123 s)
  Comment API Integration Tests
    GET /api/comments - Public Endpoints
      ✓ Should get comments for story (156 ms)
      ✓ Should handle pagination correctly (89 ms)
      ✓ Should validate required story_id (45 ms)
      ✓ Should handle invalid ObjectId (67 ms)
    GET /api/comments/search - Search Endpoint
      ✓ Should search comments successfully (123 ms)
      ✓ Should require search query (34 ms)
      ✓ Should validate query length (28 ms)
    POST /api/comments - Create Comment
      ✓ Should create comment with valid token (234 ms)
      ✓ Should reject without authentication (45 ms)
      ✓ Should validate required fields (67 ms)
      ✓ Should create reply comment (189 ms)
    Admin Endpoints
      ✓ Should reject non-admin access (56 ms)
      ✓ Should allow admin access (78 ms)
      ✓ Should moderate comments (145 ms)
    Rate Limiting
      ✓ Should enforce comment creation rate limit (567 ms)
    Performance Tests
      ✓ Should respond within acceptable time (234 ms)
      ✓ Should handle concurrent requests (445 ms)

Test Suites: 1 passed, 1 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        25.123 s
```

## 🎯 Next Steps

### **1. Extend Test Coverage**
- Add integration tests với real database
- Add load testing với nhiều concurrent users
- Add security testing (SQL injection, XSS)

### **2. CI/CD Integration**
- Setup GitHub Actions để auto-run tests
- Add test coverage reporting
- Add performance benchmarking

### **3. Frontend Integration**
- Test API compatibility với frontend
- Add E2E tests với Cypress/Playwright
- Test real user workflows

### **4. Monitoring**
- Add API response time monitoring
- Add error rate tracking
- Add usage analytics

## 📞 Support

Nếu gặp vấn đề với tests:

1. **Check MongoDB connection**: `mongosh` để test connection
2. **Check environment variables**: Đảm bảo `.env` file đúng
3. **Check test data**: Verify test users/stories exist
4. **Check logs**: Console output cho error details
5. **Run individual tests**: Isolate failing tests

---

**🎉 API Testing Suite sẵn sàng đảm bảo chất lượng code và API reliability!**
