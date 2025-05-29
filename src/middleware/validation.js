const { validationResult } = require('express-validator');

/**
 * Middleware để xử lý kết quả validation từ express-validator
 * @param {Object} req - Request object
 * @param {Object} res - Response object  
 * @param {Function} next - Next function
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Dữ liệu đầu vào không hợp lệ',
      errors: errorMessages
    });
  }
  
  next();
};

/**
 * Middleware để xử lý validation với custom error message
 * @param {string} customMessage - Custom error message
 */
const validateRequestWithMessage = (customMessage) => {
  return (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }));

      return res.status(400).json({
        success: false,
        message: customMessage || 'Dữ liệu đầu vào không hợp lệ',
        errors: errorMessages
      });
    }
    
    next();
  };
};

/**
 * Middleware để kiểm tra validation và trả về lỗi đầu tiên
 * @param {Object} req - Request object
 * @param {Object} res - Response object  
 * @param {Function} next - Next function
 */
const validateRequestFirstError = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    
    return res.status(400).json({
      success: false,
      message: firstError.msg,
      field: firstError.path || firstError.param,
      value: firstError.value
    });
  }
  
  next();
};

/**
 * Helper function để format validation errors
 * @param {Object} errors - Validation errors từ express-validator
 * @returns {Array} Formatted errors
 */
const formatValidationErrors = (errors) => {
  return errors.array().map(error => ({
    field: error.path || error.param,
    message: error.msg,
    value: error.value,
    location: error.location
  }));
};

/**
 * Helper function để kiểm tra có lỗi validation không
 * @param {Object} req - Request object
 * @returns {Object} { hasErrors: boolean, errors: Array }
 */
const checkValidationErrors = (req) => {
  const errors = validationResult(req);
  
  return {
    hasErrors: !errors.isEmpty(),
    errors: errors.isEmpty() ? [] : formatValidationErrors(errors)
  };
};

module.exports = {
  validateRequest,
  validateRequestWithMessage,
  validateRequestFirstError,
  formatValidationErrors,
  checkValidationErrors
};
