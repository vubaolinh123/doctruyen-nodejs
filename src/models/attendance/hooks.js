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

      // REMOVED: Duplicate logic đã được xử lý trong user.updateAttendance()
      // Không cần cập nhật attendance_summary ở đây vì đã được xử lý trong service
      // Logic này gây ra duplicate tăng total_days và các thống kê khác

      // Chỉ log để debug nếu cần
      if (user && user.attendance_summary && doc.status === 'attended') {
        console.log(`[AttendanceHook] Attendance record created for user ${doc.user_id} on ${doc.date}`);
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật thông tin điểm danh trong User model:', error);
    }
  });
};

module.exports = setupHooks;
