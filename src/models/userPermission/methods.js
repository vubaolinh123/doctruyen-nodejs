/**
 * Định nghĩa các instance methods cho UserPermission model
 * @param {Object} schema - Schema của UserPermission model
 */
const setupMethods = (schema) => {
  /**
   * Kiểm tra xem quyền có còn hiệu lực không
   * @returns {boolean} - true nếu quyền còn hiệu lực, false nếu không
   */
  schema.methods.isValid = function() {
    if (!this.active) {
      return false;
    }

    // Kiểm tra thời gian hết hạn
    if (this.expires_at && this.expires_at <= new Date()) {
      return false;
    }

    return true;
  };

  /**
   * Gia hạn quyền
   * @param {Date} newExpiryDate - Ngày hết hạn mới
   * @returns {Promise<Object>} - UserPermission đã cập nhật
   */
  schema.methods.extend = async function(newExpiryDate) {
    this.expires_at = newExpiryDate;
    this.active = true;
    return this.save();
  };

  /**
   * Vô hiệu hóa quyền
   * @returns {Promise<Object>} - UserPermission đã cập nhật
   */
  schema.methods.deactivate = async function() {
    this.active = false;
    return this.save();
  };

  /**
   * Kích hoạt lại quyền
   * @returns {Promise<Object>} - UserPermission đã cập nhật
   */
  schema.methods.activate = async function() {
    this.active = true;
    return this.save();
  };

  /**
   * Cập nhật giá trị quyền
   * @param {any} newValue - Giá trị mới
   * @returns {Promise<Object>} - UserPermission đã cập nhật
   */
  schema.methods.updateValue = async function(newValue) {
    this.value = newValue;
    return this.save();
  };

  /**
   * Cập nhật metadata
   * @param {Object} newMetadata - Metadata mới
   * @returns {Promise<Object>} - UserPermission đã cập nhật
   */
  schema.methods.updateMetadata = async function(newMetadata) {
    this.metadata = { ...this.metadata, ...newMetadata };
    return this.save();
  };

  /**
   * Lấy thông tin chi tiết về quyền
   * @returns {Object} - Thông tin chi tiết
   */
  schema.methods.getDetails = function() {
    return {
      id: this._id,
      name: this.name,
      description: this.description,
      type: this.type,
      value: this.value,
      source: this.source,
      reference_id: this.reference_id,
      expires_at: this.expires_at,
      active: this.active,
      granted_at: this.granted_at,
      metadata: this.metadata,
      isValid: this.isValid(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  };
};

module.exports = setupMethods;
