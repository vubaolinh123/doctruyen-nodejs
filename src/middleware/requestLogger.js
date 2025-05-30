const { getLogTimestamp } = require('../utils/timezone');

/**
 * Middleware để log incoming requests với thông tin chi tiết
 * Bổ sung cho apiLogger để có cái nhìn toàn diện về API traffic
 */
const requestLogger = (req, res, next) => {
  const timestamp = getLogTimestamp();
  const timestampColor = '\x1b[36m'; // Cyan
  const methodColor = '\x1b[34m'; // Blue
  const resetColor = '\x1b[0m';
  
  // Log incoming request
  console.log(
    `${timestampColor}[${timestamp}]${resetColor} ${methodColor}[INCOMING]${resetColor} [${req.method}] [${req.originalUrl}] from ${req.ip || req.connection.remoteAddress || 'unknown'}`
  );

  // Log headers quan trọng trong development mode
  if (process.env.NODE_ENV === 'development') {
    const importantHeaders = {
      'user-agent': req.get('User-Agent'),
      'authorization': req.get('Authorization') ? '[PRESENT]' : '[NONE]',
      'content-type': req.get('Content-Type'),
      'content-length': req.get('Content-Length')
    };

    const headerInfo = Object.entries(importantHeaders)
      .filter(([key, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    if (headerInfo) {
      console.debug(`${timestampColor}[${timestamp}]${resetColor} \x1b[35m[HEADERS]\x1b[0m ${headerInfo}`);
    }
  }

  // Log query parameters nếu có
  if (Object.keys(req.query).length > 0) {
    console.debug(`${timestampColor}[${timestamp}]${resetColor} \x1b[35m[QUERY]\x1b[0m ${JSON.stringify(req.query)}`);
  }

  next();
};

module.exports = requestLogger;
