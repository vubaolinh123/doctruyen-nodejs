/**
 * AttendanceReward Hooks
 */

module.exports = function(schema) {
  /**
   * Pre-save hook: Validate và clean data trước khi save
   */
  schema.pre('save', function(next) {
    try {
      // Validate dữ liệu
      this.validateReward();

      // Trim các string fields
      if (this.title) {
        this.title = this.title.trim();
      }
      if (this.description) {
        this.description = this.description.trim();
      }

      // Set updated_at
      this.updated_at = new Date();

      next();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Pre-findOneAndUpdate hook: Validate data khi update
   */
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    
    try {
      // Trim string fields nếu có
      if (update.title) {
        update.title = update.title.trim();
      }
      if (update.description) {
        update.description = update.description.trim();
      }

      // Set updated_at
      update.updated_at = new Date();

      next();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Post-save hook: Log khi tạo mốc phần thưởng mới
   */
  schema.post('save', function(doc) {
    if (this.isNew) {
      console.log(`[AttendanceReward] Created new reward: ${doc.title} (${doc.type}, ${doc.required_days} days)`);
    }
  });

  /**
   * Post-findOneAndUpdate hook: Log khi cập nhật
   */
  schema.post('findOneAndUpdate', function(doc) {
    if (doc) {
      console.log(`[AttendanceReward] Updated reward: ${doc.title} (ID: ${doc._id})`);
    }
  });

  /**
   * Post-findOneAndDelete hook: Log khi xóa
   */
  schema.post('findOneAndDelete', function(doc) {
    if (doc) {
      console.log(`[AttendanceReward] Deleted reward: ${doc.title} (ID: ${doc._id})`);
    }
  });
};
