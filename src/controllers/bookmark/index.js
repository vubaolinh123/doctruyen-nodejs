const baseController = require('./baseController');
const specialController = require('./specialController');

module.exports = {
  // Controllers cơ bản
  getAll: baseController.getAll,
  getById: baseController.getById,
  create: baseController.create,
  update: baseController.update,
  remove: baseController.remove,

  // Controllers đặc biệt
  getBookmarksByCustomer: specialController.getBookmarksByCustomer,
  getBookmarkByCustomerAndStory: specialController.getBookmarkByCustomerAndStory,
  upsertBookmark: specialController.upsertBookmark,
  removeAllBookmarksByCustomer: specialController.removeAllBookmarksByCustomer
}; 