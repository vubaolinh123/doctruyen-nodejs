/**
 * Định nghĩa các virtual properties cho StoriesReading model
 * @param {Object} schema - Schema của StoriesReading
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

  // Virtual cho Chapter đang đọc
  schema.virtual('chapter_reading', {
    ref: 'Chapter',
    localField: 'chapter_id_reading',
    foreignField: '_id',
    justOne: true
  });

  // Virtual cho Chapter đã đọc
  schema.virtual('chapter_read', {
    ref: 'Chapter',
    localField: 'chapter_id_read',
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
}; 