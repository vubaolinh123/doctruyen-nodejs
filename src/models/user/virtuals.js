/**
 * Định nghĩa các virtual fields cho User model
 * @param {Object} schema - Schema của User model
 */
const setupVirtuals = (schema) => {
  // Virtuals cho các quan hệ
  schema.virtual('bookmarks', {
    ref: 'Bookmark',
    localField: '_id',
    foreignField: 'user_id'
  });

  schema.virtual('purchased_stories', {
    ref: 'PurchasedStory',
    localField: '_id',
    foreignField: 'user_id'
  });

  schema.virtual('reading_history', {
    ref: 'StoriesReading',
    localField: '_id',
    foreignField: 'user_id'
  });

  schema.virtual('transactions', {
    ref: 'Transaction',
    localField: '_id',
    foreignField: 'user_id'
  });

  schema.virtual('attendance', {
    ref: 'Attendance',
    localField: '_id',
    foreignField: 'user_id'
  });

  schema.virtual('permissions', {
    ref: 'UserPermission',
    localField: '_id',
    foreignField: 'user_id'
  });

  schema.virtual('comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'user_id'
  });

  schema.virtual('liked_comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'liked_by'
  });
};

module.exports = setupVirtuals;