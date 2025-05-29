/**
 * Utility để xử lý lỗi trong các controller
 */

/**
 * Xử lý lỗi và trả về response phù hợp
 * @param {Object} res - Express response object
 * @param {Error} error - Lỗi cần xử lý
 */
const handleError = (res, error) => {
  console.error('Error:', error);

  // Nếu là lỗi đã được định nghĩa trước
  if (error.status && error.message) {
    return res.status(error.status).json({
      success: false,
      message: error.message
    });
  }

  // Nếu là lỗi validation từ Joi
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: error.details ? error.details[0].message : error.message
    });
  }

  // Nếu là lỗi từ MongoDB
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    // Lỗi duplicate key
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Dữ liệu đã tồn tại'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi cơ sở dữ liệu'
    });
  }

  // Nếu là lỗi CastError (không tìm thấy ID)
  if (error.name === 'CastError' && error.kind === 'ObjectId') {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy dữ liệu'
    });
  }

  // Lỗi mặc định
  return res.status(500).json({
    success: false,
    message: error.message || 'Lỗi máy chủ nội bộ'
  });
};

/**
 * Tạo lỗi với status code và message
 * @param {number} status - HTTP status code
 * @param {string} message - Thông báo lỗi
 * @returns {Error} - Lỗi đã được định nghĩa
 */
const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

/**
 * API Error class for structured error handling
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Handle API errors consistently
 */
const handleApiError = (res, error, defaultMessage = 'Đã xảy ra lỗi') => {
  console.error('API Error:', error);

  // If it's our custom ApiError
  if (error instanceof ApiError) {
    const response = {
      success: false,
      message: error.message
    };

    // Include details if available (for validation errors)
    if (error.details) {
      response.details = error.details;
    }

    return res.status(error.statusCode).json(response);
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      details: Object.values(error.errors).map(err => err.message)
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID không hợp lệ'
    });
  }

  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu đã tồn tại'
    });
  }

  // Default error response
  return res.status(500).json({
    success: false,
    message: defaultMessage
  });
};

module.exports = {
  handleError,
  createError,
  ApiError,
  handleApiError
};
