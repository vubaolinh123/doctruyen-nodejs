/**
 * Export tất cả controller của nhiệm vụ
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
  getDailyMissions: specialController.getDailyMissions,
  getWeeklyMissions: specialController.getWeeklyMissions,
  toggleStatus: specialController.toggleStatus,
  getMissionStats: specialController.getMissionStats,
  getUserMissionProgress: specialController.getUserMissionProgress,
  claimMissionReward: specialController.claimMissionReward
};
