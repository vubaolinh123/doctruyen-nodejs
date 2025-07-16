const baseController = require('./baseController');
const specialController = require('./specialController');
const eligibilityController = require('./eligibilityController');
const registrationController = require('./registrationController');

module.exports = {
  // Controllers cơ bản
  getAll: baseController.getAll,
  getById: baseController.getById,
  create: baseController.create,
  update: baseController.update,
  remove: baseController.remove,

  // Controllers đặc biệt
  getBySlug: specialController.getBySlug,
  getActive: specialController.getActive,

  // Controllers điều kiện đăng ký
  checkEligibility: eligibilityController.checkEligibility,
  checkUserEligibility: eligibilityController.checkUserEligibility,
  getEligibilityStats: eligibilityController.getEligibilityStats,
  getRequirements: eligibilityController.getRequirements,

  // Controllers đăng ký tác giả
  registerAsAuthor: registrationController.registerAsAuthor,
  getRegistrationInfo: registrationController.getRegistrationInfo,
  getRegistrationHistory: registrationController.getRegistrationHistory,
  getRegistrationStats: registrationController.getRegistrationStats,
  adminRegisterUser: registrationController.adminRegisterUser
};