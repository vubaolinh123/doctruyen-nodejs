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
  getByStoryId: specialController.getByStoryId,
  getChaptersByStory: specialController.getChaptersByStory,
  getLatestChapter: specialController.getLatestChapter,
  getChapterBySlug: specialController.getChapterBySlug,
  getChapterByStoryAndChapterSlug: specialController.getChapterByStoryAndChapterSlug,
  getChapterWithAccessControl: specialController.getChapterWithAccessControl,
  getChaptersByStorySlug: specialController.getChaptersByStorySlug,
  incrementViews: specialController.incrementViews,

  // Admin controllers
  getChapters: specialController.getChapters,
  toggleStatus: specialController.toggleStatus,
  toggleFlag: specialController.toggleFlag,
  getStoriesForDropdown: specialController.getStoriesForDropdown,
  getNextChapterNumber: specialController.getNextChapterNumber
};