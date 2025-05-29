/**
 * Permission Service
 * Contains business logic for permission operations
 * Refactored to follow MVC pattern
 */

const User = require('../models/user');
const Permission = require('../models/permission');
const UserPermission = require('../models/userPermission');
const { ApiError } = require('../utils/errorHandler');

/**
 * Get user's active permissions
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User permissions
 */
const getUserPermissions = async (userId) => {
  console.log(`[PermissionService] Getting permissions for user: ${userId}`);

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  // Get active user permissions
  const userPermissions = await UserPermission.find({
    user_id: userId,
    is_active: true,
    $or: [
      { expires_at: null }, // Permanent permissions
      { expires_at: { $gt: new Date() } } // Non-expired permissions
    ]
  }).populate('permission_id', 'name description category');

  // Group permissions by category
  const permissionsByCategory = {};
  const activePermissions = [];

  userPermissions.forEach(userPerm => {
    if (userPerm.permission_id) {
      const permission = {
        _id: userPerm._id,
        name: userPerm.permission_id.name,
        description: userPerm.permission_id.description,
        category: userPerm.permission_id.category,
        granted_at: userPerm.granted_at,
        expires_at: userPerm.expires_at,
        is_permanent: !userPerm.expires_at
      };

      activePermissions.push(permission);

      const category = permission.category || 'general';
      if (!permissionsByCategory[category]) {
        permissionsByCategory[category] = [];
      }
      permissionsByCategory[category].push(permission);
    }
  });

  return {
    totalPermissions: activePermissions.length,
    permissions: activePermissions,
    permissionsByCategory
  };
};

/**
 * Get all available permissions (admin only)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} All permissions
 */
const getAllPermissions = async (options = {}) => {
  const { page = 1, limit = 20, search } = options;
  
  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [permissions, total] = await Promise.all([
    Permission.find(query)
      .sort({ category: 1, name: 1 })
      .limit(limit)
      .skip(skip)
      .lean(),
    Permission.countDocuments(query)
  ]);

  return {
    permissions,
    pagination: {
      current: page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Create new permission
 * @param {Object} permissionData - Permission data
 * @returns {Promise<Object>} Created permission
 */
const createPermission = async (permissionData) => {
  const { name, description, category, duration_days } = permissionData;

  // Check if permission with same name exists
  const existingPermission = await Permission.findOne({ name });
  if (existingPermission) {
    throw new ApiError(400, 'Quyền với tên này đã tồn tại');
  }

  const permission = await Permission.create({
    name,
    description,
    category: category || 'general',
    duration_days: duration_days || null
  });

  console.log(`[PermissionService] Created new permission: ${permission.name}`);

  return permission;
};

/**
 * Update permission
 * @param {string} permissionId - Permission ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} Updated permission
 */
const updatePermission = async (permissionId, updateData) => {
  const permission = await Permission.findById(permissionId);
  if (!permission) {
    throw new ApiError(404, 'Không tìm thấy quyền');
  }

  // Check if new name conflicts with existing permission
  if (updateData.name && updateData.name !== permission.name) {
    const existingPermission = await Permission.findOne({ 
      name: updateData.name,
      _id: { $ne: permissionId }
    });
    if (existingPermission) {
      throw new ApiError(400, 'Quyền với tên này đã tồn tại');
    }
  }

  const updatedPermission = await Permission.findByIdAndUpdate(
    permissionId,
    updateData,
    { new: true, runValidators: true }
  );

  console.log(`[PermissionService] Updated permission: ${updatedPermission.name}`);

  return updatedPermission;
};

/**
 * Delete permission
 * @param {string} permissionId - Permission ID
 */
const deletePermission = async (permissionId) => {
  const permission = await Permission.findById(permissionId);
  if (!permission) {
    throw new ApiError(404, 'Không tìm thấy quyền');
  }

  // Check if permission is being used
  const usageCount = await UserPermission.countDocuments({ 
    permission_id: permissionId,
    is_active: true
  });

  if (usageCount > 0) {
    throw new ApiError(400, `Không thể xóa quyền này vì đang được sử dụng bởi ${usageCount} người dùng`);
  }

  await Permission.findByIdAndDelete(permissionId);

  console.log(`[PermissionService] Deleted permission: ${permission.name}`);
};

/**
 * Grant permission to user
 * @param {string} userId - User ID
 * @param {string} permissionId - Permission ID
 * @param {number} durationDays - Duration in days (optional)
 * @returns {Promise<Object>} Granted permission
 */
const grantPermissionToUser = async (userId, permissionId, durationDays) => {
  const [user, permission] = await Promise.all([
    User.findById(userId),
    Permission.findById(permissionId)
  ]);

  if (!user) {
    throw new ApiError(404, 'Không tìm thấy người dùng');
  }

  if (!permission) {
    throw new ApiError(404, 'Không tìm thấy quyền');
  }

  // Check if user already has this permission
  const existingUserPermission = await UserPermission.findOne({
    user_id: userId,
    permission_id: permissionId,
    is_active: true,
    $or: [
      { expires_at: null },
      { expires_at: { $gt: new Date() } }
    ]
  });

  if (existingUserPermission) {
    throw new ApiError(400, 'Người dùng đã có quyền này');
  }

  // Calculate expiration date
  let expiresAt = null;
  if (durationDays || permission.duration_days) {
    const days = durationDays || permission.duration_days;
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
  }

  const userPermission = await UserPermission.create({
    user_id: userId,
    permission_id: permissionId,
    granted_at: new Date(),
    expires_at: expiresAt,
    is_active: true
  });

  const populatedUserPermission = await UserPermission.findById(userPermission._id)
    .populate('permission_id', 'name description category')
    .populate('user_id', 'name email');

  console.log(`[PermissionService] Granted permission ${permission.name} to user ${user.email}`);

  return populatedUserPermission;
};

/**
 * Revoke permission from user
 * @param {string} userId - User ID
 * @param {string} permissionId - Permission ID
 */
const revokePermissionFromUser = async (userId, permissionId) => {
  const userPermission = await UserPermission.findOne({
    user_id: userId,
    permission_id: permissionId,
    is_active: true
  });

  if (!userPermission) {
    throw new ApiError(404, 'Không tìm thấy quyền của người dùng');
  }

  await UserPermission.findByIdAndUpdate(userPermission._id, {
    is_active: false,
    revoked_at: new Date()
  });

  console.log(`[PermissionService] Revoked permission from user: ${userId}`);
};

/**
 * Get user's permission history
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Permission history
 */
const getPermissionHistory = async (userId, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const [history, total] = await Promise.all([
    UserPermission.find({ user_id: userId })
      .populate('permission_id', 'name description category')
      .sort({ granted_at: -1 })
      .limit(limit)
      .skip(skip)
      .lean(),
    UserPermission.countDocuments({ user_id: userId })
  ]);

  return {
    history,
    pagination: {
      current: page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Check if user has specific permission
 * @param {string} userId - User ID
 * @param {string} permissionName - Permission name
 * @returns {Promise<boolean>} Has permission
 */
const checkUserPermission = async (userId, permissionName) => {
  const permission = await Permission.findOne({ name: permissionName });
  if (!permission) {
    return false;
  }

  const userPermission = await UserPermission.findOne({
    user_id: userId,
    permission_id: permission._id,
    is_active: true,
    $or: [
      { expires_at: null },
      { expires_at: { $gt: new Date() } }
    ]
  });

  return !!userPermission;
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
