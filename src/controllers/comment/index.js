const baseController = require('./baseController');
const moderationController = require('./moderationController');

module.exports = {
  // Base comment operations
  getComments: baseController.getComments,
  createComment: baseController.createComment,
  updateComment: baseController.updateComment,
  deleteComment: baseController.deleteComment,
  toggleReaction: baseController.toggleReaction,
  flagComment: baseController.flagComment,
  getCommentThread: baseController.getCommentThread,
  searchComments: baseController.searchComments,
  getCommentStats: baseController.getCommentStats,
  getHotComments: baseController.getHotComments,
  getParentCommentInfo: baseController.getParentCommentInfo,

  // Moderation operations
  getModerationQueue: moderationController.getModerationQueue,
  moderateComment: moderationController.moderateComment,
  bulkModerateComments: moderationController.bulkModerateComments,
  autoModeration: moderationController.autoModeration,
  analyzeComment: moderationController.analyzeComment,
  getModerationStats: moderationController.getModerationStats,
  getHighlyFlaggedComments: moderationController.getHighlyFlaggedComments,
  getSuspiciousComments: moderationController.getSuspiciousComments,
  getModerationHistory: moderationController.getModerationHistory,
  resetFlags: moderationController.resetFlags,
  getCommentAnalytics: moderationController.getCommentAnalytics,
  getStoriesWithComments: moderationController.getStoriesWithComments,
  getStoryCommentStats: moderationController.getStoryCommentStats,
  getChaptersWithComments: moderationController.getChaptersWithComments,
  getUsersWithComments: moderationController.getUsersWithComments,

  // Comment detail operations
  getCommentsByStory: moderationController.getCommentsByStory,
  getCommentsByChapter: moderationController.getCommentsByChapter,
  getCommentsByUser: moderationController.getCommentsByUser,
  getUserCommentActivity: moderationController.getUserCommentActivity
};
