const { getLogTimestamp } = require('../utils/timezone');

/**
 * Error handler middleware với timestamp theo múi giờ Việt Nam
 */
module.exports = (err, req, res, next) => {
  const timestamp = getLogTimestamp();
  const timestampColor = '\x1b[36m'; // Cyan
  const errorColor = '\x1b[31m'; // Red
  const resetColor = '\x1b[0m';

  // Log error với timestamp và thông tin chi tiết
  console.error(
    `${timestampColor}[${timestamp}]${resetColor} ${errorColor}[ERROR]${resetColor} [${req.method}] [${req.originalUrl}] - ${err.message}`
  );

  // Log stack trace trong development mode
  if (process.env.NODE_ENV === 'development' && err.stack) {
    console.error(`${timestampColor}[${timestamp}]${resetColor} ${errorColor}[STACK TRACE]${resetColor}\n${err.stack}`);
  }

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({ error: message });
};
