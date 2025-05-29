/**
 * Permission Routes
 * Refactored to use MVC pattern with controllers
 * Maintains backward compatibility with existing API endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { body, param } = require('express-validator');

const permissionController = require('../controllers/permissionController');

/**
 * @route GET /api/permissions/my-permissions
 * @desc Get user's permissions
 * @access User
 */
router.get('/my-permissions',
  authenticateToken,
  permissionController.getUserPermissions
);

/**
 * @route GET /api/permissions
 * @desc Get all available permissions (admin only)
 * @access Admin
 */
router.get('/',
  authenticateToken,
  requireAdmin,
  permissionController.getAllPermissions
);

/**
 * @route POST /api/permissions
 * @desc Create new permission (admin only)
 * @access Admin
 */
router.post('/',
  authenticateToken,
  requireAdmin,
  [
    body('name').notEmpty().withMessage('Tên quyền là bắt buộc'),
    body('description').notEmpty().withMessage('Mô tả quyền là bắt buộc'),
    body('category').optional().isString().withMessage('Category phải là string'),
    body('duration_days').optional().isInt({ min: 1 }).withMessage('Duration phải là số nguyên dương')
  ],
  validateRequest,
  permissionController.createPermission
);

/**
 * @route PUT /api/permissions/:permissionId
 * @desc Update permission (admin only)
 * @access Admin
 */
router.put('/:permissionId',
  authenticateToken,
  requireAdmin,
  [
    param('permissionId').isMongoId().withMessage('Permission ID không hợp lệ'),
    body('name').optional().notEmpty().withMessage('Tên quyền không được rỗng'),
    body('description').optional().notEmpty().withMessage('Mô tả quyền không được rỗng'),
    body('category').optional().isString().withMessage('Category phải là string'),
    body('duration_days').optional().isInt({ min: 1 }).withMessage('Duration phải là số nguyên dương')
  ],
  validateRequest,
  permissionController.updatePermission
);

/**
 * @route DELETE /api/permissions/:permissionId
 * @desc Delete permission (admin only)
 * @access Admin
 */
router.delete('/:permissionId',
  authenticateToken,
  requireAdmin,
  [
    param('permissionId').isMongoId().withMessage('Permission ID không hợp lệ')
  ],
  validateRequest,
  permissionController.deletePermission
);

/**
 * @route POST /api/permissions/grant
 * @desc Grant permission to user (admin only)
 * @access Admin
 */
router.post('/grant',
  authenticateToken,
  requireAdmin,
  [
    body('userId').isMongoId().withMessage('User ID không hợp lệ'),
    body('permissionId').isMongoId().withMessage('Permission ID không hợp lệ'),
    body('duration_days').optional().isInt({ min: 1 }).withMessage('Duration phải là số nguyên dương')
  ],
  validateRequest,
  permissionController.grantPermissionToUser
);

/**
 * @route POST /api/permissions/revoke
 * @desc Revoke permission from user (admin only)
 * @access Admin
 */
router.post('/revoke',
  authenticateToken,
  requireAdmin,
  [
    body('userId').isMongoId().withMessage('User ID không hợp lệ'),
    body('permissionId').isMongoId().withMessage('Permission ID không hợp lệ')
  ],
  validateRequest,
  permissionController.revokePermissionFromUser
);

/**
 * @route GET /api/permissions/history
 * @desc Get user's permission history
 * @access User
 */
router.get('/history',
  authenticateToken,
  permissionController.getPermissionHistory
);

/**
 * @route GET /api/permissions/check/:permissionName
 * @desc Check if user has specific permission
 * @access User
 */
router.get('/check/:permissionName',
  authenticateToken,
  [
    param('permissionName').notEmpty().withMessage('Permission name là bắt buộc')
  ],
  validateRequest,
  permissionController.checkUserPermission
);

module.exports = router;
