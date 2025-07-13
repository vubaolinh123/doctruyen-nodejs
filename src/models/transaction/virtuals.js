/**
 * Định nghĩa các virtual properties cho Transaction model
 * @param {Object} schema - Schema của Transaction
 */
module.exports = function(schema) {
  const { convertToVietnamTimezoneForAPI } = require('../../utils/timezone');

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

  // Override toJSON to format dates properly for frontend
  schema.methods.toJSON = function() {
    const obj = this.toObject();

    // Helper function to remove Z suffix if date is already in Vietnam timezone
    const formatDateForAPI = (dateString) => {
      if (!dateString) return dateString;

      // If it's already a string and doesn't end with Z, return as is
      if (typeof dateString === 'string' && !dateString.endsWith('Z')) {
        return dateString;
      }

      // If it ends with Z, check if it's actually Vietnam time mislabeled as UTC
      if (typeof dateString === 'string' && dateString.endsWith('Z')) {
        // For transaction_date, it's likely already Vietnam time but with Z suffix
        // Just remove the Z suffix
        return dateString.replace('Z', '');
      }

      // For Date objects, convert to Vietnam timezone
      if (dateString instanceof Date) {
        return convertToVietnamTimezoneForAPI(dateString);
      }

      return dateString;
    };

    // Format transaction_date (likely already Vietnam time but with Z suffix)
    if (obj.transaction_date) {
      obj.transaction_date = formatDateForAPI(obj.transaction_date);
    }

    // Format createdAt and updatedAt (likely already Vietnam time but with Z suffix)
    if (obj.createdAt) {
      obj.createdAt = formatDateForAPI(obj.createdAt);
    }

    if (obj.updatedAt) {
      obj.updatedAt = formatDateForAPI(obj.updatedAt);
    }

    // Format claimed_at in metadata (likely already Vietnam time but with Z suffix)
    if (obj.metadata && obj.metadata.claimed_at) {
      obj.metadata.claimed_at = formatDateForAPI(obj.metadata.claimed_at);
    }

    return obj;
  };
};