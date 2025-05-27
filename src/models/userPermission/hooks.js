/**
 * Định nghĩa các hooks cho UserPermission model
 * @param {Object} schema - Schema của UserPermission model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Thực hiện các validation và chuẩn hóa dữ liệu trước khi lưu
   */
  schema.pre('save', function(next) {
    // Chuẩn hóa tên quyền (lowercase, trim)
    if (this.isModified('name')) {
      this.name = this.name.toLowerCase().trim();
    }

    // Chuẩn hóa description
    if (this.isModified('description')) {
      this.description = this.description.trim();
    }

    // Kiểm tra logic expires_at
    if (this.expires_at && this.expires_at <= new Date()) {
      // Nếu thời gian hết hạn đã qua, tự động set active = false
      this.active = false;
    }

    // Đảm bảo granted_at không được null
    if (!this.granted_at) {
      this.granted_at = new Date();
    }

    next();
  });

  /**
   * Pre-validate hook
   * Validation bổ sung trước khi validate
   */
  schema.pre('validate', function(next) {
    // Kiểm tra reference_id phù hợp với source
    if (this.reference_id && !['achievement', 'level', 'purchase'].includes(this.source)) {
      this.reference_id = null;
    }

    // Đảm bảo expires_at không được set trong quá khứ khi tạo mới
    if (this.isNew && this.expires_at && this.expires_at <= new Date()) {
      return next(new Error('Thời gian hết hạn không thể là thời điểm trong quá khứ'));
    }

    next();
  });

  /**
   * Post-save hook
   * Thực hiện các tác vụ sau khi lưu thành công
   */
  schema.post('save', async function(doc) {
    try {
      // Log việc cấp quyền mới
      if (doc.isNew) {
        console.log(`[UserPermission] Đã cấp quyền "${doc.name}" cho user ${doc.user_id}`);
      }

      // Có thể thêm logic gửi notification, cập nhật cache, etc.
      // Ví dụ: gửi thông báo cho user khi được cấp quyền mới
      
    } catch (error) {
      console.error('[UserPermission] Lỗi trong post-save hook:', error);
    }
  });

  /**
   * Post-remove hook
   * Thực hiện các tác vụ sau khi xóa
   */
  schema.post('remove', async function(doc) {
    try {
      console.log(`[UserPermission] Đã xóa quyền "${doc.name}" của user ${doc.user_id}`);
      
      // Có thể thêm logic dọn dẹp liên quan, gửi notification, etc.
      
    } catch (error) {
      console.error('[UserPermission] Lỗi trong post-remove hook:', error);
    }
  });

  /**
   * Pre-deleteOne hook
   * Thực hiện trước khi xóa một document
   */
  schema.pre('deleteOne', { document: true, query: false }, function(next) {
    console.log(`[UserPermission] Chuẩn bị xóa quyền "${this.name}" của user ${this.user_id}`);
    next();
  });

  /**
   * Pre-deleteMany hook
   * Thực hiện trước khi xóa nhiều documents
   */
  schema.pre('deleteMany', function(next) {
    console.log('[UserPermission] Chuẩn bị xóa nhiều quyền:', this.getQuery());
    next();
  });

  /**
   * Pre-updateOne hook
   * Thực hiện trước khi cập nhật
   */
  schema.pre('updateOne', function(next) {
    // Cập nhật updatedAt
    this.set({ updatedAt: new Date() });
    
    // Kiểm tra expires_at trong update
    const update = this.getUpdate();
    if (update.expires_at && update.expires_at <= new Date()) {
      this.set({ active: false });
    }
    
    next();
  });

  /**
   * Pre-updateMany hook
   * Thực hiện trước khi cập nhật nhiều documents
   */
  schema.pre('updateMany', function(next) {
    // Cập nhật updatedAt cho tất cả documents được update
    this.set({ updatedAt: new Date() });
    next();
  });

  /**
   * Post-init hook
   * Thực hiện sau khi khởi tạo document từ database
   */
  schema.post('init', function() {
    // Có thể thêm logic khởi tạo bổ sung nếu cần
  });
};

module.exports = setupHooks;
