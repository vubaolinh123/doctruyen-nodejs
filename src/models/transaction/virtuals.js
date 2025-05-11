/**
 * Định nghĩa các virtual properties cho Transaction model
 * @param {Object} schema - Schema của Transaction
 */
module.exports = function(schema) {
  // Virtuals để populate các thông tin liên quan

  // Virtual cho User
  schema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual tương thích ngược
  schema.virtual('customer', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });
}; 