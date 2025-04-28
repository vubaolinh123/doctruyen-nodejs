const cron = require('node-cron');
const attendanceController = require('../controllers/attendanceController');

// Chạy hàng ngày lúc 00:05 để cập nhật trạng thái missed cho các ngày bỏ lỡ
const setupAttendanceCron = () => {
  cron.schedule('5 0 * * *', async () => {
    console.log('Running attendance cron job to update missed days');
    try {
      await attendanceController.updateMissedDays();
      console.log('Attendance cron job completed successfully');
    } catch (error) {
      console.error('Error running attendance cron job:', error);
    }
  });
};

module.exports = setupAttendanceCron;
