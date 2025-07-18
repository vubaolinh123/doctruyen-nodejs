const { getLogTimestamp, formatDuration } = require('../utils/timezone');

/**
 * Middleware logging API requests với timestamp theo múi giờ Việt Nam
 * Format: [timestamp] [HTTP method] [endpoint] [status code] [response time]
 */
const apiLogger = (req, res, next) => {
  // Lưu thời gian bắt đầu
  const start = Date.now();

  // Flag để đảm bảo chỉ log 1 lần cho mỗi request
  let hasLogged = false;

  // Hàm để log response - chỉ chạy 1 lần
  const logResponse = (body = null) => {
    // Nếu đã log rồi thì không log nữa
    if (hasLogged) return;
    hasLogged = true;

    // Tính thời gian xử lý
    const duration = Date.now() - start;

    // Tạo timestamp khi response hoàn thành
    const timestamp = getLogTimestamp();

    // Xác định màu và icon dựa trên status code
    let statusIcon = '✅';
    let methodColor = '\x1b[32m'; // Xanh lá
    let statusColor = '\x1b[32m'; // Xanh lá
    let timestampColor = '\x1b[36m'; // Cyan
    let resetColor = '\x1b[0m';

    if (res.statusCode >= 400 && res.statusCode < 500) {
      statusIcon = '⚠️';
      methodColor = '\x1b[33m'; // Vàng
      statusColor = '\x1b[33m'; // Vàng
    } else if (res.statusCode >= 500) {
      statusIcon = '❌';
      methodColor = '\x1b[31m'; // Đỏ
      statusColor = '\x1b[31m'; // Đỏ
    }

    // Format log theo yêu cầu: [timestamp] [HTTP method] [endpoint] [status code] [response time]
    console.log(
      `${timestampColor}[${timestamp}]${resetColor} ${methodColor}[${req.method}]${resetColor} [${req.originalUrl}] ${statusIcon} ${statusColor}[${res.statusCode}]${resetColor} [${formatDuration(duration)}]`
    );

    // Nếu có lỗi, hiển thị thông tin lỗi với timestamp
    if (res.statusCode >= 400 && body && (body.error || body.message)) {
      console.error(`${timestampColor}[${timestamp}]${resetColor} \x1b[31m[ERROR]\x1b[0m ${JSON.stringify(body.error || body.message)}`);
    }

    // Log thêm thông tin chi tiết cho development
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn(`${timestampColor}[${timestamp}]${resetColor} \x1b[33m[SLOW REQUEST]\x1b[0m ${req.method} ${req.originalUrl} took ${formatDuration(duration)}`);
    }

    // Log request body cho POST/PUT/PATCH requests trong development mode
    if (process.env.NODE_ENV === 'development' && ['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      console.debug(`${timestampColor}[${timestamp}]${resetColor} \x1b[35m[REQUEST BODY]\x1b[0m ${JSON.stringify(req.body, null, 2)}`);
    }
  };

  // Sử dụng event 'finish' để log khi response hoàn thành
  // Cách này hiệu quả hơn và tránh override multiple methods
  res.on('finish', () => {
    logResponse();
  });

  next();
};

module.exports = apiLogger;