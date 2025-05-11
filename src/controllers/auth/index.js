const baseController = require('./baseController');
const specialController = require('./specialController');

module.exports = {
  // Controllers cơ bản
  register: baseController.register,
  login: baseController.login,
  oath: baseController.oath,

  // Controllers đặc biệt
  refreshToken: specialController.refreshToken,
  getMe: specialController.getMe,
  updateProfile: specialController.updateProfile,
  logout: specialController.logout,
  generateAdminToken: specialController.generateAdminToken
}; 