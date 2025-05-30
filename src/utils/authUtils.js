/**
 * Authentication Utilities for Backend
 * Common authentication helper functions
 */

/**
 * Check if user has admin role
 * @param {string|number} userRole - User role from token/session
 * @returns {boolean} - True if user is admin
 */
function isAdminRole(userRole) {
  // Support both string "admin" and numeric role 2
  return userRole === 'admin' || userRole === 2 || String(userRole) === '2';
}

/**
 * Check if user has author role
 * @param {string|number} userRole - User role from token/session
 * @returns {boolean} - True if user is author
 */
function isAuthorRole(userRole) {
  return userRole === 'author' || userRole === 1 || String(userRole) === '1';
}

/**
 * Check if user has regular user role
 * @param {string|number} userRole - User role from token/session
 * @returns {boolean} - True if user is regular user
 */
function isUserRole(userRole) {
  return userRole === 'user' || userRole === 0 || String(userRole) === '0';
}

/**
 * Get role name from role value
 * @param {string|number} userRole - User role value
 * @returns {string} - Role name
 */
function getRoleName(userRole) {
  if (isAdminRole(userRole)) return 'admin';
  if (isAuthorRole(userRole)) return 'author';
  if (isUserRole(userRole)) return 'user';
  return 'unknown';
}

/**
 * Check if user has permission level
 * @param {string|number} userRole - User role from token/session
 * @param {string} requiredRole - Required role ('admin', 'author', 'user')
 * @returns {boolean} - True if user has required permission
 */
function hasPermission(userRole, requiredRole) {
  const roleHierarchy = {
    'admin': 2,
    'author': 1,
    'user': 0
  };

  const userLevel = roleHierarchy[getRoleName(userRole)];
  const requiredLevel = roleHierarchy[requiredRole];

  return userLevel >= requiredLevel;
}

/**
 * Extract user ID from request (supports both _id and id fields)
 * @param {Object} user - User object from req.user
 * @returns {string} - User ID
 */
function getUserId(user) {
  return user._id || user.id;
}

/**
 * Validate user object has required fields
 * @param {Object} user - User object to validate
 * @returns {boolean} - True if user object is valid
 */
function isValidUser(user) {
  return user && (user._id || user.id) && user.role !== undefined;
}

/**
 * Create error response for unauthorized access
 * @param {string} message - Error message
 * @returns {Object} - Error response object
 */
function createUnauthorizedError(message = 'Unauthorized access') {
  return {
    success: false,
    message,
    code: 'UNAUTHORIZED'
  };
}

/**
 * Create error response for forbidden access
 * @param {string} message - Error message
 * @returns {Object} - Error response object
 */
function createForbiddenError(message = 'Forbidden access') {
  return {
    success: false,
    message,
    code: 'FORBIDDEN'
  };
}

module.exports = {
  isAdminRole,
  isAuthorRole,
  isUserRole,
  getRoleName,
  hasPermission,
  getUserId,
  isValidUser,
  createUnauthorizedError,
  createForbiddenError
};
