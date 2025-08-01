const baseController = require('./baseController');
const specialController = require('./specialController');

module.exports = {
  // Controllers cơ bản
  getAll: baseController.getAll,
  getById: baseController.getById,
  getBySlug: baseController.getBySlug,
  create: baseController.create,
  update: baseController.update,
  remove: baseController.remove,
  incrementViews: baseController.incrementViews,

  // Controllers đặc biệt
  getPopularStories: specialController.getPopularStories,
  getHotStories: specialController.getHotStories,
  getTopRatedStories: specialController.getTopRatedStories,
  getRecentStories: specialController.getRecentStories,
  getStoriesByCategory: specialController.getStoriesByCategory,
  getStoriesByAuthor: specialController.getStoriesByAuthor,
  searchStories: specialController.searchStories,
  getNewStories: specialController.getNewStories,
  getFullStories: specialController.getFullStories,
  getSuggestedStories: specialController.getSuggestedStories,
  getMostCommented: specialController.getMostCommented
};