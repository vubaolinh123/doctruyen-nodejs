/**
 * Controller xử lý các chức năng liên quan đến quyền của người dùng
 */
const User = require('../../models/user');
const { handleError, createError } = require('../../utils/errorHandler');

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
    const user = await User.findById(id).select('_id name email permissions');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }
    
    // Lấy danh sách quyền đang hoạt động
    const activePermissions = user.getActivePermissions();
    
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
    if (!permissionData.name) {
      return res.status(400).json({
        success: false,
        message: 'Tên quyền là bắt buộc'
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
    await user.addPermission({
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
      permission: permissionData.name
    });
  } catch (error) {
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
    await user.removePermission(name);
    
    return res.json({
      success: true,
      message: 'Xóa quyền thành công',
      permission: name
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
    await user.deactivatePermission(name);
    
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
    await user.activatePermission(name);
    
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
    const permissionIndex = user.permissions.findIndex(p => p.name === name);
    
    if (permissionIndex < 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quyền'
      });
    }
    
    // Cập nhật quyền
    const updatedPermission = {
      ...user.permissions[permissionIndex].toObject(),
      ...updateData,
      name, // Giữ nguyên tên quyền
      metadata: {
        ...user.permissions[permissionIndex].metadata,
        ...updateData.metadata,
        updated_by: {
          admin_id: req.user.id,
          admin_name: req.user.name,
          updated_at: new Date()
        }
      }
    };
    
    user.permissions[permissionIndex] = updatedPermission;
    await user.save();
    
    return res.json({
      success: true,
      message: 'Cập nhật quyền thành công',
      permission: updatedPermission
    });
  } catch (error) {
    return handleError(res, error);
  }
};
