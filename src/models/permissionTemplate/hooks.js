/**
 * Định nghĩa các hooks cho PermissionTemplate model
 * @param {Object} schema - Schema của PermissionTemplate model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Thực hiện các validation và chuẩn hóa dữ liệu trước khi lưu
   */
  schema.pre('save', function(next) {
    // Chuẩn hóa tên permission (lowercase, trim)
    if (this.isModified('name')) {
      this.name = this.name.toLowerCase().trim();
    }

    // Chuẩn hóa display_name
    if (this.isModified('display_name')) {
      this.display_name = this.display_name.trim();
    }

    // Chuẩn hóa description
    if (this.isModified('description')) {
      this.description = this.description.trim();
    }

    // Chuẩn hóa category
    if (this.isModified('category')) {
      this.category = this.category.trim();
    }

    // Chuẩn hóa tags
    if (this.isModified('tags')) {
      this.tags = this.tags
        .map(tag => tag.toLowerCase().trim())
        .filter(tag => tag.length > 0)
        .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates
    }

    // Validate default_expiry_days
    if (this.can_expire && this.default_expiry_days && this.default_expiry_days <= 0) {
      return next(new Error('Số ngày hết hạn phải lớn hơn 0'));
    }

    // Validate value_config theo value_type
    if (this.isModified('value_config') || this.isModified('value_type')) {
      const validationResult = this.validateValueConfig();
      if (!validationResult.isValid) {
        return next(new Error(validationResult.error));
      }
    }

    // Validate default_value theo value_type
    if (this.isModified('default_value') || this.isModified('value_type') || this.isModified('value_config')) {
      const validationResult = this.validateValue(this.default_value);
      if (!validationResult.isValid) {
        return next(new Error('Giá trị mặc định không hợp lệ: ' + validationResult.error));
      }
    }

    // Set updated_by nếu không phải tạo mới
    if (!this.isNew && this.isModified() && !this.isModified('updated_by')) {
      // Sẽ được set từ controller
    }

    next();
  });

  /**
   * Pre-validate hook
   * Validation bổ sung trước khi validate
   */
  schema.pre('validate', function(next) {
    // Đảm bảo dependencies không chứa chính nó
    if (this.dependencies && this.dependencies.includes(this.name)) {
      return next(new Error('Permission không thể phụ thuộc vào chính nó'));
    }

    // Đảm bảo conflicts không chứa chính nó
    if (this.conflicts && this.conflicts.includes(this.name)) {
      return next(new Error('Permission không thể xung đột với chính nó'));
    }

    // Đảm bảo dependencies và conflicts không trùng nhau
    if (this.dependencies && this.conflicts) {
      const intersection = this.dependencies.filter(dep => this.conflicts.includes(dep));
      if (intersection.length > 0) {
        return next(new Error(`Permissions không thể vừa phụ thuộc vừa xung đột: ${intersection.join(', ')}`));
      }
    }

    next();
  });

  /**
   * Post-save hook
   * Thực hiện các tác vụ sau khi lưu thành công
   */
  schema.post('save', async function(doc) {
    try {
      // Log việc tạo/cập nhật template
      if (doc.isNew) {
        console.log(`[PermissionTemplate] Đã tạo template mới: "${doc.display_name}" (${doc.name})`);
      } else {
        console.log(`[PermissionTemplate] Đã cập nhật template: "${doc.display_name}" (${doc.name})`);
      }

      // Cập nhật cache nếu cần
      // TODO: Implement cache invalidation

      // Gửi notification cho admins nếu cần
      // TODO: Implement notification system

    } catch (error) {
      console.error('[PermissionTemplate] Lỗi trong post-save hook:', error);
    }
  });

  /**
   * Post-remove hook
   * Thực hiện các tác vụ sau khi xóa
   */
  schema.post('remove', async function(doc) {
    try {
      console.log(`[PermissionTemplate] Đã xóa template: "${doc.display_name}" (${doc.name})`);
      
      // TODO: Cleanup related data if needed
      
    } catch (error) {
      console.error('[PermissionTemplate] Lỗi trong post-remove hook:', error);
    }
  });

  /**
   * Pre-deleteOne hook
   * Thực hiện trước khi xóa một document
   */
  schema.pre('deleteOne', { document: true, query: false }, async function(next) {
    try {
      // Kiểm tra xem template có đang được sử dụng không
      const isInUse = await this.isInUse();
      if (isInUse) {
        return next(new Error('Không thể xóa template đang được sử dụng'));
      }

      console.log(`[PermissionTemplate] Chuẩn bị xóa template: "${this.display_name}" (${this.name})`);
      next();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Pre-deleteMany hook
   * Thực hiện trước khi xóa nhiều documents
   */
  schema.pre('deleteMany', function(next) {
    console.log('[PermissionTemplate] Chuẩn bị xóa nhiều templates:', this.getQuery());
    next();
  });

  /**
   * Pre-updateOne hook
   * Thực hiện trước khi cập nhật
   */
  schema.pre('updateOne', function(next) {
    // Cập nhật updatedAt
    this.set({ updatedAt: new Date() });
    
    // Chuẩn hóa dữ liệu trong update
    const update = this.getUpdate();
    if (update.name) {
      this.set({ name: update.name.toLowerCase().trim() });
    }
    if (update.display_name) {
      this.set({ display_name: update.display_name.trim() });
    }
    if (update.description) {
      this.set({ description: update.description.trim() });
    }
    if (update.category) {
      this.set({ category: update.category.trim() });
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

/**
 * Helper method để validate value_config
 */
const setupValidationHelpers = (schema) => {
  /**
   * Validate value_config theo value_type
   */
  schema.methods.validateValueConfig = function() {
    const { value_type, value_config } = this;

    try {
      switch (value_type) {
        case 'number':
          if (value_config.min !== undefined && value_config.max !== undefined) {
            if (value_config.min >= value_config.max) {
              return { isValid: false, error: 'Min phải nhỏ hơn max' };
            }
          }
          break;

        case 'string':
          if (value_config.minLength !== undefined && value_config.maxLength !== undefined) {
            if (value_config.minLength >= value_config.maxLength) {
              return { isValid: false, error: 'MinLength phải nhỏ hơn maxLength' };
            }
          }
          if (value_config.options && !Array.isArray(value_config.options)) {
            return { isValid: false, error: 'Options phải là mảng' };
          }
          break;

        case 'array':
          if (value_config.minItems !== undefined && value_config.maxItems !== undefined) {
            if (value_config.minItems >= value_config.maxItems) {
              return { isValid: false, error: 'MinItems phải nhỏ hơn maxItems' };
            }
          }
          break;
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Lỗi validation config: ' + error.message };
    }
  };
};

module.exports = (schema) => {
  setupHooks(schema);
  setupValidationHelpers(schema);
};
