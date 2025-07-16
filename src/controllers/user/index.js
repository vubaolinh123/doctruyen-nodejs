const baseController = require('./baseController');
const specialController = require('./specialController');
const adminController = require('./adminController');
const analyticsController = require('./analyticsController');

module.exports = {
  // Controllers cơ bản
  getAll: adminController.getAllUsersAdmin, // Sử dụng admin version với filters
  getById: baseController.getById,
  create: baseController.create,
  update: baseController.update,
  remove: adminController.deleteUser, // Sử dụng admin version

  // Controllers đặc biệt
  getBySlug: specialController.getBySlug,
  getSlugById: specialController.getSlugById,
  getUserComprehensiveStats: specialController.getUserComprehensiveStats,

  // Admin controllers
  getUserStats: adminController.getUserStats,
  updateUserStatus: adminController.updateUserStatus,
  updateUserRole: adminController.updateUserRole,
  bulkUserOperations: adminController.bulkUserOperations,
  getUserDeletionPreview: adminController.getUserDeletionPreview,
  bulkDeleteUsers: adminController.bulkDeleteUsers,

  // Analytics controllers
  getRegistrationStats: analyticsController.getRegistrationStats,
  getRegistrationOverview: analyticsController.getRegistrationOverview,
  getRegistrationByType: analyticsController.getRegistrationByType,
  getGrowthRate: analyticsController.getGrowthRate
};