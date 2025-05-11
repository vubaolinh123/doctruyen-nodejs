/**
 * Export tất cả controller của giao dịch
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
  getStatsByUser: specialController.getStatsByUser,
  getChartData: specialController.getChartData,
  getAdminStats: specialController.getAdminStats
}; 