/**
 * Export tất cả controller của truyện đã mua
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
  checkPurchased: specialController.checkPurchased,
  findByCustomer: specialController.findByCustomer,
  purchaseStory: specialController.purchaseStory
}; 