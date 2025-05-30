const moment = require('moment-timezone');

/**
 * Utility functions để xử lý timezone cho Việt Nam
 */

// Múi giờ Việt Nam
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Lấy timestamp hiện tại theo múi giờ Việt Nam
 * @param {string} format - Format của timestamp (mặc định: 'DD/MM/YYYY HH:mm:ss')
 * @returns {string} Timestamp đã format
 */
const getVietnamTimestamp = (format = 'DD/MM/YYYY HH:mm:ss') => {
  // Lấy thời gian UTC thực sự từ Date object và chuyển đổi sang timezone Việt Nam
  // Sử dụng new Date() để lấy UTC time chính xác
  const utcTime = new Date();
  return moment.utc(utcTime).tz(VIETNAM_TIMEZONE).format(format);
};

/**
 * Chuyển đổi một Date object hoặc timestamp thành múi giờ Việt Nam
 * @param {Date|string|number} date - Date object, ISO string, hoặc timestamp
 * @param {string} format - Format của output (mặc định: 'DD/MM/YYYY HH:mm:ss')
 * @returns {string} Timestamp đã format theo múi giờ Việt Nam
 */
const toVietnamTime = (date, format = 'DD/MM/YYYY HH:mm:ss') => {
  // Chuyển đổi thời gian từ timezone hiện tại sang timezone VN
  return moment(date).tz(VIETNAM_TIMEZONE).format(format);
};

/**
 * Lấy timestamp cho logging với format chuẩn
 * @returns {string} Timestamp format cho logging
 */
const getLogTimestamp = () => {
  return getVietnamTimestamp('DD/MM/YYYY HH:mm:ss');
};

/**
 * Lấy timestamp chi tiết với milliseconds
 * @returns {string} Timestamp với milliseconds
 */
const getDetailedTimestamp = () => {
  return getVietnamTimestamp('DD/MM/YYYY HH:mm:ss.SSS');
};

/**
 * Lấy ngày hiện tại theo múi giờ Việt Nam (chỉ ngày)
 * @returns {string} Ngày theo format DD/MM/YYYY
 */
const getVietnamDate = () => {
  return getVietnamTimestamp('DD/MM/YYYY');
};

/**
 * Lấy giờ hiện tại theo múi giờ Việt Nam (chỉ giờ)
 * @returns {string} Giờ theo format HH:mm:ss
 */
const getVietnamTime = () => {
  return getVietnamTimestamp('HH:mm:ss');
};

/**
 * Kiểm tra xem có phải là cùng ngày theo múi giờ Việt Nam không
 * @param {Date|string|number} date1 - Ngày thứ nhất
 * @param {Date|string|number} date2 - Ngày thứ hai
 * @returns {boolean} True nếu cùng ngày
 */
const isSameDayVietnam = (date1, date2) => {
  const day1 = moment(date1).tz(VIETNAM_TIMEZONE).format('YYYY-MM-DD');
  const day2 = moment(date2).tz(VIETNAM_TIMEZONE).format('YYYY-MM-DD');
  return day1 === day2;
};

/**
 * Lấy đầu ngày theo múi giờ Việt Nam (00:00:00)
 * @param {Date|string|number} date - Ngày cần lấy đầu ngày (mặc định: hôm nay)
 * @returns {Date} Date object đầu ngày
 */
const getStartOfDayVietnam = (date = new Date()) => {
  return moment.tz(date, VIETNAM_TIMEZONE).startOf('day').toDate();
};

/**
 * Lấy cuối ngày theo múi giờ Việt Nam (23:59:59.999)
 * @param {Date|string|number} date - Ngày cần lấy cuối ngày (mặc định: hôm nay)
 * @returns {Date} Date object cuối ngày
 */
const getEndOfDayVietnam = (date = new Date()) => {
  return moment.tz(date, VIETNAM_TIMEZONE).endOf('day').toDate();
};

/**
 * Format duration thành chuỗi dễ đọc
 * @param {number} milliseconds - Thời gian tính bằng milliseconds
 * @returns {string} Duration đã format
 */
const formatDuration = (milliseconds) => {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }
};

module.exports = {
  VIETNAM_TIMEZONE,
  getVietnamTimestamp,
  toVietnamTime,
  getLogTimestamp,
  getDetailedTimestamp,
  getVietnamDate,
  getVietnamTime,
  isSameDayVietnam,
  getStartOfDayVietnam,
  getEndOfDayVietnam,
  formatDuration
};
