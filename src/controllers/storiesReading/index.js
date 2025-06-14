/**
 * Export tất cả controller của lịch sử đọc truyện
 * Cập nhật để hỗ trợ schema mới và các tính năng nâng cao
 */
const baseController = require('./baseController');
const specialController = require('./specialController');

// Kết hợp tất cả các controllers
module.exports = {
  // Base CRUD operations
  getAll: baseController.getAll,
  getById: baseController.getById,
  create: baseController.create,
  update: baseController.update,
  remove: baseController.remove,

  // Core reading operations
  findByUserAndStory: specialController.findByUserAndStory,
  findByUser: specialController.findByUser,
  upsertReading: specialController.upsertReading,
  updateReadingStatus: specialController.updateReadingStatus,

  // Bookmark operations
  addBookmark: specialController.addBookmark,
  removeBookmark: specialController.removeBookmark,

  // Personal notes
  updatePersonalNotes: specialController.updatePersonalNotes,

  // Statistics and analytics
  getUserReadingStats: specialController.getUserReadingStats,
  getRecentlyRead: specialController.getRecentlyRead,

  // Search functionality
  searchReadingHistory: specialController.searchReadingHistory,

  // Legacy support (deprecated, use updateReadingStatus instead)
  updateChapterRead: specialController.updateReadingStatus
};