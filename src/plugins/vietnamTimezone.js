/**
 * Plugin để chuyển đổi timezone cho các trường Date trong MongoDB
 * Chuyển đổi từ UTC sang múi giờ Việt Nam (UTC+7)
 */

module.exports = function vietnamTimezonePlugin(schema) {
  // Ghi đè phương thức toJSON để chuyển đổi các trường Date
  schema.set('toJSON', {
    transform: function(doc, ret) {
      // Chuyển đổi createdAt
      if (ret.createdAt) {
        ret.createdAt = convertToVietnamTime(ret.createdAt);
      }

      // Chuyển đổi updatedAt
      if (ret.updatedAt) {
        ret.updatedAt = convertToVietnamTime(ret.updatedAt);
      }

      // Chuyển đổi các trường Date khác nếu cần
      // Ví dụ: transaction_date, date, attendance_time, v.v.
      if (ret.transaction_date) {
        ret.transaction_date = convertToVietnamTime(ret.transaction_date);
      }

      if (ret.date) {
        ret.date = convertToVietnamTime(ret.date);
      }

      if (ret.attendance_time) {
        ret.attendance_time = convertToVietnamTime(ret.attendance_time);
      }

      return ret;
    }
  });

  // Ghi đè phương thức toObject để chuyển đổi các trường Date
  schema.set('toObject', {
    transform: function(doc, ret) {
      // Chuyển đổi createdAt
      if (ret.createdAt) {
        ret.createdAt = convertToVietnamTime(ret.createdAt);
      }

      // Chuyển đổi updatedAt
      if (ret.updatedAt) {
        ret.updatedAt = convertToVietnamTime(ret.updatedAt);
      }

      // Chuyển đổi các trường Date khác nếu cần
      if (ret.transaction_date) {
        ret.transaction_date = convertToVietnamTime(ret.transaction_date);
      }

      if (ret.date) {
        ret.date = convertToVietnamTime(ret.date);
      }

      if (ret.attendance_time) {
        ret.attendance_time = convertToVietnamTime(ret.attendance_time);
      }

      return ret;
    }
  });

  // Thêm pre-save hook để đảm bảo các trường Date mới được tạo đều sử dụng múi giờ Việt Nam
  schema.pre('save', function(next) {
    // Nếu document mới được tạo, đảm bảo createdAt và updatedAt sử dụng múi giờ Việt Nam
    if (this.isNew) {
      const now = new Date();

      // Không cần chuyển đổi vì mongoose sẽ tự động thiết lập createdAt và updatedAt
      // Chúng ta sẽ chuyển đổi khi trả về dữ liệu thông qua toJSON và toObject
    }

    next();
  });
};

/**
 * Hàm chuyển đổi thời gian từ UTC sang múi giờ Việt Nam (UTC+7)
 * @param {Date} date - Đối tượng Date cần chuyển đổi
 * @returns {Date} - Đối tượng Date đã được chuyển đổi sang múi giờ Việt Nam
 */
function convertToVietnamTime(date) {
  if (!date) return date;

  // Tạo một bản sao của đối tượng Date để tránh thay đổi đối tượng gốc
  const vietnamDate = new Date(date);

  // Lấy thời gian UTC
  const utcTime = vietnamDate.getTime();

  // Chuyển đổi sang múi giờ Việt Nam (UTC+7)
  // Thêm 7 giờ (7 * 60 * 60 * 1000 milliseconds)
  const vietnamTime = new Date(utcTime + (7 * 60 * 60 * 1000));

  return vietnamTime;
}
