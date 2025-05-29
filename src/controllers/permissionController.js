/**
 * Permission Controller
 * Handles HTTP requests and responses for permission operations
 * Refactored to follow MVC pattern
 */

const permissionService = require('../services/permissionService');
const { handleApiError, ApiError } = require('../utils/errorHandler');

/**
 * @desc Get user's permissions
 * @route GET /api/permissions/my-permissions
 * @access User
 */
const getUserPermissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await permissionService.getUserPermissions(userId);
    
    res.json({
      success: true,
      message: 'Lấy danh sách quyền thành công',
      data: result
    });
  } catch (error) {
    console.error('[PermissionController] Error in getUserPermissions:', error);
    handleApiError(res, error, 'Lỗi khi lấy danh sách quyền');
  }
};

/**
 * @desc Get all available permissions (admin only)
 * @route GET /api/permissions
 * @access Admin
 */
const getAllPermissions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search
    };
    
    const result = await permissionService.getAllPermissions(options);
    
    res.json({
      success: true,
      message: 'Lấy danh sách tất cả quyền thành công',
      data: result
    });
  } catch (error) {
    console.error('[PermissionController] Error in getAllPermissions:', error);
    handleApiError(res, error, 'Lỗi khi lấy danh sách quyền');
  }
};

/**
 * @desc Create new permission (admin only)
 * @route POST /api/permissions
 * @access Admin
 */
const createPermission = async (req, res) => {
  try {
    const { name, description, category, duration_days } = req.body;
    
    if (!name || !description) {
      throw new ApiError(400, 'Tên và mô tả quyền là bắt buộc');
    }
    
    const permissionData = {
      name,
      description,
      category: category || 'general',
      duration_days: duration_days || null
    };
    
    const result = await permissionService.createPermission(permissionData);
    
    res.status(201).json({
      success: true,
      message: 'Tạo quyền mới thành công',
      data: result
    });
  } catch (error) {
    console.error('[PermissionController] Error in createPermission:', error);
    handleApiError(res, error, 'Lỗi khi tạo quyền mới');
  }
};

/**
 * @desc Update permission (admin only)
 * @route PUT /api/permissions/:permissionId
 * @access Admin
 */
const updatePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const updateData = req.body;
    
    const result = await permissionService.updatePermission(permissionId, updateData);
    
    res.json({
      success: true,
      message: 'Cập nhật quyền thành công',
      data: result
    });
  } catch (error) {
    console.error('[PermissionController] Error in updatePermission:', error);
    handleApiError(res, error, 'Lỗi khi cập nhật quyền');
  }
};

/**
 * @desc Delete permission (admin only)
 * @route DELETE /api/permissions/:permissionId
 * @access Admin
 */
const deletePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    
    await permissionService.deletePermission(permissionId);
    
    res.json({
      success: true,
      message: 'Xóa quyền thành công'
    });
  } catch (error) {
    console.error('[PermissionController] Error in deletePermission:', error);
    handleApiError(res, error, 'Lỗi khi xóa quyền');
  }
};

/**
 * @desc Grant permission to user (admin only)
 * @route POST /api/permissions/grant
 * @access Admin
 */
const grantPermissionToUser = async (req, res) => {
  try {
    const { userId, permissionId, duration_days } = req.body;
    
    if (!userId || !permissionId) {
      throw new ApiError(400, 'User ID và Permission ID là bắt buộc');
    }
    
    const result = await permissionService.grantPermissionToUser(userId, permissionId, duration_days);
    
    res.json({
      success: true,
      message: 'Cấp quyền cho người dùng thành công',
      data: result
    });
  } catch (error) {
    console.error('[PermissionController] Error in grantPermissionToUser:', error);
    handleApiError(res, error, 'Lỗi khi cấp quyền cho người dùng');
  }
};

/**
 * @desc Revoke permission from user (admin only)
 * @route POST /api/permissions/revoke
 * @access Admin
 */
const revokePermissionFromUser = async (req, res) => {
  try {
    const { userId, permissionId } = req.body;
    
    if (!userId || !permissionId) {
      throw new ApiError(400, 'User ID và Permission ID là bắt buộc');
    }
    
    await permissionService.revokePermissionFromUser(userId, permissionId);
    
    res.json({
      success: true,
      message: 'Thu hồi quyền từ người dùng thành công'
    });
  } catch (error) {
    console.error('[PermissionController] Error in revokePermissionFromUser:', error);
    handleApiError(res, error, 'Lỗi khi thu hồi quyền từ người dùng');
  }
};

/**
 * @desc Get user's permission history
 * @route GET /api/permissions/history
 * @access User
 */
const getPermissionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit)
    };
    
    const result = await permissionService.getPermissionHistory(userId, options);
    
    res.json({
      success: true,
      message: 'Lấy lịch sử quyền thành công',
      data: result
    });
  } catch (error) {
    console.error('[PermissionController] Error in getPermissionHistory:', error);
    handleApiError(res, error, 'Lỗi khi lấy lịch sử quyền');
  }
};

/**
 * @desc Check if user has specific permission
 * @route GET /api/permissions/check/:permissionName
 * @access User
 */
const checkUserPermission = async (req, res) => {
  try {
    const userId = req.user.id;
    const { permissionName } = req.params;
    
    const hasPermission = await permissionService.checkUserPermission(userId, permissionName);
    
    res.json({
      success: true,
      data: {
        hasPermission,
        permissionName
      }
    });
  } catch (error) {
    console.error('[PermissionController] Error in checkUserPermission:', error);
    handleApiError(res, error, 'Lỗi khi kiểm tra quyền');
  }
};

module.exports = {
  getUserPermissions,
  getAllPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  grantPermissionToUser,
  revokePermissionFromUser,
  getPermissionHistory,
  checkUserPermission
};
