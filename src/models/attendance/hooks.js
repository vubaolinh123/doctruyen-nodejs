/**
 * Định nghĩa các hooks cho Attendance model
 * @param {Object} schema - Schema của Attendance model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Đảm bảo các trường ngày tháng năm được đồng bộ với trường date
   */
  schema.pre('save', function(next) {
    if (this.isModified('date')) {
      // Cập nhật các trường day, month, year từ trường date
      this.day = this.date.getDate();
      this.month = this.date.getMonth();
      this.year = this.date.getFullYear();
    }
    next();
  });

  /**
   * Post-save hook
   * Cập nhật thông tin điểm danh trong User model
   */
  schema.post('save', async function(doc) {
    try {
      // Lấy model User
      const User = this.model('User');
      
      // Tìm người dùng
      const user = await User.findById(doc.user_id);
      
      if (user && user.attendance_summary) {
        // Cập nhật thông tin điểm danh trong User model
        if (doc.status === 'attended') {
          // Tăng tổng số ngày điểm danh
          user.attendance_summary.total_days += 1;
          
          // Cập nhật ngày điểm danh gần nhất
          user.attendance_summary.last_attendance = doc.date;
          
          // Cập nhật streak nếu cần
          if (doc.streak_count > user.attendance_summary.current_streak) {
            user.attendance_summary.current_streak = doc.streak_count;
            
            // Cập nhật longest streak nếu cần
            if (doc.streak_count > user.attendance_summary.longest_streak) {
              user.attendance_summary.longest_streak = doc.streak_count;
            }
          }
          
          await user.save();
        }
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật thông tin điểm danh trong User model:', error);
    }
  });
};

module.exports = setupHooks;
