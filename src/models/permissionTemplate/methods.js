/**
 * Định nghĩa các instance methods cho PermissionTemplate model
 * @param {Object} schema - Schema của PermissionTemplate model
 */
const setupMethods = (schema) => {
  /**
   * Kiểm tra xem template có đang được sử dụng không
   * @returns {Promise<boolean>} - true nếu đang được sử dụng
   */
  schema.methods.isInUse = async function() {
    const UserPermission = require('../userPermission');
    const count = await UserPermission.countDocuments({ template_id: this._id });
    return count > 0;
  };

  /**
   * Lấy số lượng users đang sử dụng template này
   * @returns {Promise<number>} - Số lượng users
   */
  schema.methods.getUsageCount = async function() {
    const UserPermission = require('../userPermission');
    return await UserPermission.countDocuments({ template_id: this._id });
  };

  /**
   * Lấy danh sách users đang sử dụng template này
   * @param {Object} options - Tùy chọn phân trang
   * @returns {Promise<Array>} - Danh sách users
   */
  schema.methods.getUsers = async function(options = {}) {
    const UserPermission = require('../userPermission');
    const { page = 1, limit = 10 } = options;
    
    return await UserPermission.find({ template_id: this._id })
      .populate('user_id', 'name email avatar')
      .sort({ granted_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  };

  /**
   * Kích hoạt template
   * @returns {Promise<Object>} - Template đã cập nhật
   */
  schema.methods.activate = async function() {
    this.is_active = true;
    return this.save();
  };

  /**
   * Vô hiệu hóa template
   * @returns {Promise<Object>} - Template đã cập nhật
   */
  schema.methods.deactivate = async function() {
    this.is_active = false;
    return this.save();
  };

  /**
   * Cập nhật metadata
   * @param {Object} newMetadata - Metadata mới
   * @returns {Promise<Object>} - Template đã cập nhật
   */
  schema.methods.updateMetadata = async function(newMetadata) {
    this.metadata = { ...this.metadata, ...newMetadata };
    return this.save();
  };

  /**
   * Thêm tag
   * @param {string} tag - Tag cần thêm
   * @returns {Promise<Object>} - Template đã cập nhật
   */
  schema.methods.addTag = async function(tag) {
    if (!this.tags.includes(tag.toLowerCase())) {
      this.tags.push(tag.toLowerCase());
      return this.save();
    }
    return this;
  };

  /**
   * Xóa tag
   * @param {string} tag - Tag cần xóa
   * @returns {Promise<Object>} - Template đã cập nhật
   */
  schema.methods.removeTag = async function(tag) {
    this.tags = this.tags.filter(t => t !== tag.toLowerCase());
    return this.save();
  };

  /**
   * Kiểm tra dependencies
   * @param {Array} userPermissions - Danh sách permissions hiện tại của user
   * @returns {Object} - Kết quả kiểm tra
   */
  schema.methods.checkDependencies = function(userPermissions = []) {
    const userPermissionNames = userPermissions.map(p => p.name);
    const missingDependencies = this.dependencies.filter(dep => 
      !userPermissionNames.includes(dep)
    );

    return {
      canGrant: missingDependencies.length === 0,
      missingDependencies
    };
  };

  /**
   * Kiểm tra conflicts
   * @param {Array} userPermissions - Danh sách permissions hiện tại của user
   * @returns {Object} - Kết quả kiểm tra
   */
  schema.methods.checkConflicts = function(userPermissions = []) {
    const userPermissionNames = userPermissions.map(p => p.name);
    const conflictingPermissions = this.conflicts.filter(conflict => 
      userPermissionNames.includes(conflict)
    );

    return {
      hasConflicts: conflictingPermissions.length > 0,
      conflictingPermissions
    };
  };

  /**
   * Validate giá trị theo value_type và value_config
   * @param {any} value - Giá trị cần validate
   * @returns {Object} - Kết quả validation
   */
  schema.methods.validateValue = function(value) {
    const { value_type, value_config } = this;

    try {
      switch (value_type) {
        case 'boolean':
          if (typeof value !== 'boolean') {
            return { isValid: false, error: 'Giá trị phải là boolean' };
          }
          break;

        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            return { isValid: false, error: 'Giá trị phải là số' };
          }
          if (value_config.min !== undefined && value < value_config.min) {
            return { isValid: false, error: `Giá trị phải >= ${value_config.min}` };
          }
          if (value_config.max !== undefined && value > value_config.max) {
            return { isValid: false, error: `Giá trị phải <= ${value_config.max}` };
          }
          break;

        case 'string':
          if (typeof value !== 'string') {
            return { isValid: false, error: 'Giá trị phải là chuỗi' };
          }
          if (value_config.minLength && value.length < value_config.minLength) {
            return { isValid: false, error: `Độ dài tối thiểu ${value_config.minLength}` };
          }
          if (value_config.maxLength && value.length > value_config.maxLength) {
            return { isValid: false, error: `Độ dài tối đa ${value_config.maxLength}` };
          }
          if (value_config.options && !value_config.options.includes(value)) {
            return { isValid: false, error: 'Giá trị không hợp lệ' };
          }
          break;

        case 'array':
          if (!Array.isArray(value)) {
            return { isValid: false, error: 'Giá trị phải là mảng' };
          }
          if (value_config.minItems && value.length < value_config.minItems) {
            return { isValid: false, error: `Tối thiểu ${value_config.minItems} phần tử` };
          }
          if (value_config.maxItems && value.length > value_config.maxItems) {
            return { isValid: false, error: `Tối đa ${value_config.maxItems} phần tử` };
          }
          break;

        case 'object':
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return { isValid: false, error: 'Giá trị phải là object' };
          }
          break;
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Lỗi validation: ' + error.message };
    }
  };

  /**
   * Lấy thông tin chi tiết template
   * @returns {Object} - Thông tin chi tiết
   */
  schema.methods.getDetails = async function() {
    const usageCount = await this.getUsageCount();
    
    return {
      id: this._id,
      name: this.name,
      display_name: this.display_name,
      description: this.description,
      type: this.type,
      category: this.category,
      default_value: this.default_value,
      value_type: this.value_type,
      value_config: this.value_config,
      is_active: this.is_active,
      can_expire: this.can_expire,
      default_expiry_days: this.default_expiry_days,
      priority: this.priority,
      dependencies: this.dependencies,
      conflicts: this.conflicts,
      tags: this.tags,
      metadata: this.metadata,
      usage_count: usageCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  };
};

module.exports = setupMethods;
