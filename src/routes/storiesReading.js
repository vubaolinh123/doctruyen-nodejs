const express = require('express');
const router = express.Router();
const controller = require('../controllers/storiesReading');

// ============================================
// TEST ROUTE (for debugging)
// ============================================
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Stories Reading API is working',
    user: req.user || null,
    timestamp: new Date().toISOString()
  });
});



// ============================================
// ROUTES CRUD CƠ BẢN
// ============================================
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

// ============================================
// ROUTES THEO USER
// ============================================

// Lấy danh sách lịch sử đọc của user (với filtering)
router.get('/user/:userId', controller.findByUser);

// Lấy thống kê đọc của user
router.get('/user/:userId/stats', controller.getUserReadingStats);

// Lấy danh sách truyện đang đọc gần đây
router.get('/user/:userId/recent', controller.getRecentlyRead);

// Tìm kiếm trong lịch sử đọc
router.get('/user/:userId/search', controller.searchReadingHistory);

// Lấy tất cả bookmarks của user từ tất cả stories
router.get('/user/:userId/bookmarks', controller.getAllUserBookmarks);

// ============================================
// ROUTES THEO USER VÀ STORY
// ============================================

// Lấy lịch sử đọc cụ thể của user cho một story
router.get('/user/:userId/story/:storyId', controller.findByUserAndStory);

// Cập nhật hoặc tạo mới lịch sử đọc (upsert pattern)
router.post('/user/:userId/story/:storyId', controller.upsertReading);

// Cập nhật trạng thái đọc
router.put('/user/:userId/story/:storyId/status', controller.updateReadingStatus);

// Cập nhật ghi chú cá nhân
router.put('/user/:userId/story/:storyId/notes', controller.updatePersonalNotes);

// Xóa toàn bộ lịch sử đọc của user cho một story (bao gồm tất cả bookmarks)
router.delete('/user/:userId/story/:storyId', controller.deleteUserStoryReading);

// ============================================
// BOOKMARK ROUTES
// ============================================

// Thêm bookmark
router.post('/user/:userId/story/:storyId/bookmarks', controller.addBookmark);

// Lấy tất cả bookmarks của một story
router.get('/user/:userId/story/:storyId/bookmarks', controller.getBookmarks);

// Xóa bookmark
router.delete('/user/:userId/story/:storyId/bookmarks/:bookmarkId', controller.removeBookmark);

// ============================================
// LEGACY ROUTES (Deprecated - for backward compatibility)
// ============================================

// Legacy route - sử dụng updateReadingStatus thay thế
router.put('/user/:userId/story/:storyId/read', controller.updateChapterRead);

module.exports = router;