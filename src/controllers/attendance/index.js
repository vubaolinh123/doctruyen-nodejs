const specialController = require('./specialController');

module.exports = {
  // Controllers điểm danh
  getAttendanceHistory: specialController.getAttendanceHistory,
  checkIn: specialController.checkIn,
  updateMissedDays: specialController.updateMissedDays
}; 