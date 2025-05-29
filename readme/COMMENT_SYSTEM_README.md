# 🚀 Hệ Thống Comment Mới - Hoàn Toàn Tái Cấu Trúc

## 📋 Tổng Quan

Hệ thống comment đã được tái cấu trúc hoàn toàn với các tính năng tiên tiến:

### ✨ Tính Năng Chính

- **Nested Comments**: Hỗ trợ bình luận phân cấp tối đa 3 levels
- **Materialized Path**: Tối ưu performance cho hierarchical data
- **Advanced Moderation**: Auto spam/toxicity detection
- **Rate Limiting**: Ngăn chặn spam và abuse
- **Caching System**: Tối ưu performance với in-memory cache
- **Real-time Features**: Like/dislike, mentions, notifications
- **Security**: XSS prevention, input sanitization
- **Analytics**: Engagement scoring, statistics

### 🏗️ Kiến Trúc

```
src/
├── models/comment/
│   ├── schema.js          # Database schema với materialized path
│   ├── methods.js         # Instance methods
│   ├── statics.js         # Static methods với optimized queries
│   ├── virtuals.js        # Virtual fields
│   ├── hooks.js           # Pre/post hooks
│   └── index.js           # Main model file
├── services/comment/
│   ├── commentService.js  # Core business logic
│   ├── moderationService.js # Content moderation
│   └── cacheService.js    # Caching logic
├── controllers/comment/
│   ├── baseController.js  # CRUD operations
│   ├── moderationController.js # Admin moderation
│   └── index.js           # Controller exports
├── middleware/
│   ├── commentRateLimit.js # Rate limiting & spam detection
│   └── commentValidation.js # Input validation
└── routes/
    ├── commentRoutes.js   # Public comment routes
    └── admin/commentModeration.js # Admin routes
```

## 🔧 API Endpoints

### Public Routes

```
GET    /api/comments                    # Lấy danh sách comments
GET    /api/comments/search             # Tìm kiếm comments
GET    /api/comments/:id/thread         # Lấy comment thread
GET    /api/comments/stats              # Thống kê comments
GET    /api/comments/hot                # Hot comments
```

### Protected Routes

```
POST   /api/comments                    # Tạo comment mới
PUT    /api/comments/:id                # Cập nhật comment
DELETE /api/comments/:id                # Xóa comment
POST   /api/comments/:id/reaction       # Like/dislike
POST   /api/comments/:id/flag           # Báo cáo comment
```

### Admin Routes

```
GET    /api/admin/comments/queue        # Queue cần moderation
POST   /api/admin/comments/:id/moderate # Moderate comment
POST   /api/admin/comments/bulk-moderate # Bulk moderation
POST   /api/admin/comments/auto-moderate # Auto moderation
GET    /api/admin/comments/stats        # Moderation stats
```

## 📊 Database Schema

### Comment Document Structure

```javascript
{
  user_id: ObjectId,
  target: {
    story_id: ObjectId,
    chapter_id: ObjectId,
    type: 'story' | 'chapter'
  },
  content: {
    original: String,
    sanitized: String,
    mentions: [{ user_id, username, position }]
  },
  hierarchy: {
    path: String,           // "/root_id/parent_id/comment_id/"
    parent_id: ObjectId,
    level: Number,          // 0-3
    root_id: ObjectId
  },
  engagement: {
    likes: { count, users: [ObjectId] },
    dislikes: { count, users: [ObjectId] },
    replies: { count, last_reply_at },
    score: Number           // Calculated engagement score
  },
  moderation: {
    status: 'active' | 'pending' | 'hidden' | 'deleted' | 'spam',
    flags: { count, reasons, flagged_by },
    auto_moderation: { spam_score, toxicity_score }
  },
  metadata: {
    ip_hash: String,
    user_agent_hash: String,
    edit_history: [{ content, edited_at, edit_reason }],
    chapter_position: Number
  }
}
```

## 🚀 Cách Sử Dụng

### 1. Tạo Comment

```javascript
POST /api/comments
{
  "content": "Nội dung bình luận",
  "target": {
    "story_id": "story_id_here",
    "type": "story"
  }
}
```

### 2. Tạo Reply

```javascript
POST /api/comments
{
  "content": "Nội dung reply",
  "target": {
    "story_id": "story_id_here",
    "type": "story"
  },
  "hierarchy": {
    "parent_id": "parent_comment_id"
  }
}
```

### 3. Like/Dislike

```javascript
POST /api/comments/:id/reaction
{
  "action": "like" | "dislike" | "remove"
}
```

### 4. Lấy Comments với Pagination

```javascript
GET /api/comments?story_id=xxx&limit=20&sort=newest&cursor=xxx
```

## 🛡️ Security Features

### Rate Limiting

- **General**: 50 requests/15 minutes per IP
- **Create Comment**: 5 comments/minute per user
- **Like/Dislike**: 30 reactions/minute per user
- **Flag**: 10 flags/5 minutes per user

### Spam Detection

- Excessive caps detection
- Special characters ratio
- Repeated characters
- Common spam patterns
- URL detection
- Content length validation

### Content Moderation

- Auto spam score calculation
- Toxicity detection (Vietnamese)
- User reporting system
- Admin moderation queue
- Bulk moderation tools

## ⚡ Performance Optimizations

### Database Indexes

```javascript
// Compound indexes for common queries
{ 'target.story_id': 1, 'moderation.status': 1, createdAt: -1 }
{ 'target.chapter_id': 1, 'moderation.status': 1, createdAt: -1 }
{ 'hierarchy.path': 1, 'moderation.status': 1, createdAt: -1 }
{ 'engagement.score': -1, createdAt: -1 }

// Text search index
{ 'content.sanitized': 'text' }
```

### Caching Strategy

- **Comments List**: 5 minutes TTL
- **Comment Threads**: 10 minutes TTL
- **Hot Comments**: 30 minutes TTL
- **Statistics**: 15 minutes TTL

### Cursor-based Pagination

Sử dụng cursor thay vì offset để tối ưu performance:

```javascript
// Thay vì skip/limit
GET /api/comments?story_id=xxx&cursor=2024-01-01T00:00:00Z&limit=20
```

## 🧪 Testing

### Chạy Tests

```bash
# Basic functionality test
node src/scripts/testCommentSystem.js basic

# Performance test
node src/scripts/testCommentSystem.js performance

# Spam detection test
node src/scripts/testCommentSystem.js spam

# All tests
node src/scripts/testCommentSystem.js all
```

## 📈 Monitoring & Analytics

### Engagement Metrics

- Like/dislike ratios
- Reply counts
- Time-based engagement scoring
- Hot/trending comment detection

### Moderation Metrics

- Spam detection accuracy
- Flag-to-action ratios
- Moderation response times
- Auto-moderation effectiveness

## 🔄 Migration từ Hệ Thống Cũ

Hệ thống cũ đã được xóa hoàn toàn. Nếu cần migrate data:

1. Export comments từ database backup
2. Transform data theo schema mới
3. Import với materialized path calculation
4. Rebuild engagement scores

## 🚨 Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**: Giảm tần suất request
2. **Validation Errors**: Check input format
3. **Permission Denied**: Verify user authentication
4. **Cache Issues**: Clear cache manually nếu cần

### Debug Commands

```bash
# Check comment structure
db.comments.findOne().pretty()

# Check indexes
db.comments.getIndexes()

# Performance analysis
db.comments.explain().find(query)
```

## 📞 Support

Nếu gặp vấn đề, hãy check:

1. Console logs cho error details
2. Database connection
3. Rate limiting status
4. User permissions

---

**🎉 Hệ thống comment mới đã sẵn sàng sử dụng với performance và security tối ưu!**
