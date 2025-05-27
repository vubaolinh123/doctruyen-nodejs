/**
 * Controller xử lý các chức năng liên quan đến quyền của người dùng
 */
const User = require('../../models/user');
const UserPermission = require('../../models/userPermission');
const PermissionTemplate = require('../../models/permissionTemplate');
const { handleError } = require('../../utils/errorHandler');

/**
 * Lấy danh sách quyền của người dùng
 * @route GET /api/users/:id/permissions
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra quyền truy cập
    if (req.user.id !== id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem thông tin này'
      });
    }

    // Tìm người dùng
    const user = await User.findById(id).select('_id name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Lấy danh sách quyền đang hoạt động
    const activePermissions = await UserPermission.getActivePermissions(id);

    return res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      },
      permissions: activePermissions,
      total: activePermissions.length
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Thêm quyền cho người dùng (chỉ admin)
 * @route POST /api/admin/users/:id/permissions
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.addPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const permissionData = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!permissionData.template_id) {
      return res.status(400).json({
        success: false,
        message: 'template_id là bắt buộc'
      });
    }

    // Tìm người dùng
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Thêm quyền cho người dùng
    const permission = await UserPermission.addOrUpdatePermission(id, {
      ...permissionData,
      source: permissionData.source || 'admin',
      metadata: {
        ...permissionData.metadata,
        admin_id: req.user.id,
        admin_name: req.user.name
      }
    });

    return res.json({
      success: true,
      message: 'Thêm quyền thành công',
      permission: permission
    });
  } catch (error) {
    if (error.message.includes('template_id') || error.message.includes('template')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    return handleError(res, error);
  }
};

/**
 * Xóa quyền của người dùng (chỉ admin)
 * @route DELETE /api/admin/users/:id/permissions/:name
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.removePermission = async (req, res) => {
  try {
    const { id, name } = req.params;

    // Tìm người dùng
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Xóa quyền của người dùng
    const result = await UserPermission.removePermission(id, name);

    return res.json({
      success: true,
      message: 'Xóa quyền thành công',
      permission: name,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Vô hiệu hóa quyền của người dùng (chỉ admin)
 * @route PUT /api/admin/users/:id/permissions/:name/deactivate
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.deactivatePermission = async (req, res) => {
  try {
    const { id, name } = req.params;

    // Tìm người dùng
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Vô hiệu hóa quyền của người dùng
    const permission = await UserPermission.findUserPermission(id, name);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quyền'
      });
    }

    await permission.deactivate();

    return res.json({
      success: true,
      message: 'Vô hiệu hóa quyền thành công',
      permission: name
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Kích hoạt quyền của người dùng (chỉ admin)
 * @route PUT /api/admin/users/:id/permissions/:name/activate
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.activatePermission = async (req, res) => {
  try {
    const { id, name } = req.params;

    // Tìm người dùng
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Kích hoạt quyền của người dùng
    const permission = await UserPermission.findUserPermission(id, name);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quyền'
      });
    }

    await permission.activate();

    return res.json({
      success: true,
      message: 'Kích hoạt quyền thành công',
      permission: name
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Cập nhật quyền của người dùng (chỉ admin)
 * @route PUT /api/admin/users/:id/permissions/:name
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updatePermission = async (req, res) => {
  try {
    const { id, name } = req.params;
    const updateData = req.body;

    // Tìm người dùng
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Tìm quyền cần cập nhật
    const permission = await UserPermission.findUserPermission(id, name);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quyền'
      });
    }

    // Cập nhật quyền
    Object.assign(permission, {
      ...updateData,
      name, // Giữ nguyên tên quyền
      metadata: {
        ...permission.metadata,
        ...updateData.metadata,
        updated_by: {
          admin_id: req.user.id,
          admin_name: req.user.name,
          updated_at: new Date()
        }
      }
    });

    await permission.save();

    return res.json({
      success: true,
      message: 'Cập nhật quyền thành công',
      permission: permission
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Lấy danh sách permission templates cho dropdown (chỉ admin)
 * @route GET /api/admin/permission-templates/dropdown
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getPermissionTemplatesForDropdown = async (req, res) => {
  try {
    const { category = '', type = '' } = req.query;

    const templates = await PermissionTemplate.getActiveTemplates({
      category,
      type
    });

    // Format cho dropdown
    const dropdownData = templates.map(template => ({
      id: template._id,
      name: template.name,
      display_name: template.display_name,
      description: template.description,
      category: template.category,
      type: template.type,
      value_type: template.value_type,
      value_config: template.value_config,
      default_value: template.default_value,
      can_expire: template.can_expire,
      default_expiry_days: template.default_expiry_days,
      dependencies: template.dependencies,
      conflicts: template.conflicts,
      metadata: template.metadata
    }));

    return res.json({
      success: true,
      data: dropdownData
    });
  } catch (error) {
    return handleError(res, error);
  }
};