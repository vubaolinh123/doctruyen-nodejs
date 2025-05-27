/**
 * Định nghĩa các static methods cho UserPermission model
 * @param {Object} schema - Schema của UserPermission model
 */
const setupStatics = (schema) => {
  /**
   * Tìm tất cả quyền của một người dùng
   * @param {string} userId - ID của người dùng
   * @param {Object} options - Tùy chọn lọc
   * @returns {Promise<Array>} - Danh sách quyền
   */
  schema.statics.findByUserId = function(userId, options = {}) {
    const query = { user_id: userId };

    // Lọc theo trạng thái active
    if (options.activeOnly !== undefined) {
      query.active = options.activeOnly;
    }

    // Lọc theo loại quyền
    if (options.type) {
      query.type = options.type;
    }

    // Lọc theo nguồn gốc
    if (options.source) {
      query.source = options.source;
    }

    return this.find(query).sort({ granted_at: -1 });
  };

  /**
   * Tìm quyền cụ thể của người dùng
   * @param {string} userId - ID của người dùng
   * @param {string} permissionName - Tên quyền
   * @returns {Promise<Object|null>} - Quyền tìm thấy hoặc null
   */
  schema.statics.findUserPermission = function(userId, permissionName) {
    return this.findOne({
      user_id: userId,
      name: permissionName
    });
  };

  /**
   * Kiểm tra người dùng có quyền cụ thể không
   * @param {string} userId - ID của người dùng
   * @param {string} permissionName - Tên quyền
   * @returns {Promise<boolean>} - true nếu có quyền, false nếu không
   */
  schema.statics.hasPermission = async function(userId, permissionName) {
    const permission = await this.findOne({
      user_id: userId,
      name: permissionName,
      active: true
    });

    if (!permission) {
      return false;
    }

    // Kiểm tra thời gian hết hạn
    if (permission.expires_at && permission.expires_at <= new Date()) {
      return false;
    }

    return true;
  };

  /**
   * Lấy tất cả quyền đang hoạt động của người dùng
   * @param {string} userId - ID của người dùng
   * @returns {Promise<Array>} - Danh sách quyền đang hoạt động
   */
  schema.statics.getActivePermissions = function(userId) {
    const now = new Date();
    return this.find({
      user_id: userId,
      active: true,
      $or: [
        { expires_at: null },
        { expires_at: { $gt: now } }
      ]
    }).sort({ granted_at: -1 });
  };

  /**
   * Thêm hoặc cập nhật quyền cho người dùng
   * @param {string} userId - ID của người dùng
   * @param {Object} permissionData - Dữ liệu quyền (bao gồm template_id)
   * @returns {Promise<Object>} - Quyền đã tạo/cập nhật
   */
  schema.statics.addOrUpdatePermission = async function(userId, permissionData) {
    // Validate template_id
    if (!permissionData.template_id) {
      throw new Error('template_id là bắt buộc');
    }

    const PermissionTemplate = require('../permissionTemplate');
    const template = await PermissionTemplate.findById(permissionData.template_id);

    if (!template) {
      throw new Error('Không tìm thấy permission template');
    }

    if (!template.is_active) {
      throw new Error('Permission template không hoạt động');
    }

    // Kiểm tra permission đã tồn tại chưa (theo template_id)
    const existingPermission = await this.findOne({
      user_id: userId,
      template_id: permissionData.template_id
    });

    // Lấy thông tin từ template
    const permissionFromTemplate = {
      name: template.name,
      type: template.type,
      description: permissionData.description || template.description,
      value: permissionData.value !== undefined ? permissionData.value : template.default_value
    };

    // Validate giá trị theo template
    const valueValidation = template.validateValue(permissionFromTemplate.value);
    if (!valueValidation.isValid) {
      throw new Error('Giá trị không hợp lệ: ' + valueValidation.error);
    }

    // Tính toán expires_at nếu template có thể hết hạn
    let expires_at = permissionData.expires_at;
    if (template.can_expire && !expires_at && template.default_expiry_days) {
      expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + template.default_expiry_days);
    }

    if (existingPermission) {
      // Cập nhật quyền hiện có
      Object.assign(existingPermission, {
        ...permissionFromTemplate,
        ...permissionData,
        template_id: permissionData.template_id,
        user_id: userId,
        expires_at,
        granted_at: new Date()
      });
      return existingPermission.save();
    } else {
      // Tạo quyền mới
      return this.create({
        ...permissionFromTemplate,
        ...permissionData,
        template_id: permissionData.template_id,
        user_id: userId,
        expires_at,
        granted_at: new Date()
      });
    }
  };

  /**
   * Xóa quyền của người dùng
   * @param {string} userId - ID của người dùng
   * @param {string} permissionName - Tên quyền
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.statics.removePermission = function(userId, permissionName) {
    return this.deleteOne({
      user_id: userId,
      name: permissionName
    });
  };

  /**
   * Xóa tất cả quyền của người dùng
   * @param {string} userId - ID của người dùng
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.statics.removeAllUserPermissions = function(userId) {
    return this.deleteMany({ user_id: userId });
  };

  /**
   * Lấy thống kê quyền theo loại
   * @param {string} userId - ID của người dùng (tùy chọn)
   * @returns {Promise<Array>} - Thống kê quyền
   */
  schema.statics.getPermissionStats = function(userId = null) {
    const mongoose = require('mongoose');
    const matchStage = userId ? { user_id: new mongoose.Types.ObjectId(userId) } : {};

    return this.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          active_count: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$active', true] },
                    {
                      $or: [
                        { $eq: ['$expires_at', null] },
                        { $gt: ['$expires_at', new Date()] }
                      ]
                    }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  };

  /**
   * Dọn dẹp quyền hết hạn
   * @returns {Promise<Object>} - Kết quả dọn dẹp
   */
  schema.statics.cleanupExpiredPermissions = function() {
    const now = new Date();
    return this.updateMany(
      {
        expires_at: { $lte: now },
        active: true
      },
      {
        $set: { active: false }
      }
    );
  };
};

module.exports = setupStatics;
