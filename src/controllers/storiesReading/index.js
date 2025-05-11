/**
 * Export tất cả controller của lịch sử đọc truyện
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
  
  // Special operations
  findByUserAndStory: specialController.findByUserAndStory,
  findByUser: specialController.findByUser,
  upsertReading: specialController.upsertReading,
  updateChapterRead: specialController.updateChapterRead
}; 