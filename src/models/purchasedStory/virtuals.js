/**
 * Định nghĩa các virtual properties cho PurchasedStory model
 * @param {Object} schema - Schema của PurchasedStory
 */
module.exports = function(schema) {
  // Virtuals để populate các thông tin liên quan

  // Virtual cho Story
  schema.virtual('story', {
    ref: 'Story',
    localField: 'story_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual cho User
  schema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual cho Transaction
  schema.virtual('transaction', {
    ref: 'Transaction',
    localField: 'transaction_id',
    foreignField: '_id',
    justOne: true
  });
}; 