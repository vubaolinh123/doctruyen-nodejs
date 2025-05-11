const cron = require('node-cron');
const attendanceController = require('../controllers/attendance');

// Chạy hàng ngày lúc 00:05 để cập nhật trạng thái missed cho các ngày bỏ lỡ
const setupAttendanceCron = () => {
  cron.schedule('5 0 * * *', async () => {
    console.log('Đang chạy công việc cron điểm danh để cập nhật các ngày bỏ lỡ');
    try {
      await attendanceController.updateMissedDays();
      console.log('Công việc cron điểm danh đã hoàn thành thành công');
    } catch (error) {
      console.error('Lỗi khi chạy công việc cron điểm danh:', error);
    }
  });
};

module.exports = setupAttendanceCron;
