const baseController = require('./baseController');
const specialController = require('./specialController');

module.exports = {
  // Controllers cơ bản
  getComments: baseController.getComments,
  createComment: baseController.createComment,
  updateComment: baseController.updateComment,
  deleteComment: baseController.deleteComment,

  // Controllers đặc biệt
  toggleLike: specialController.toggleLike
}; 