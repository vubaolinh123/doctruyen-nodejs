/**
 * Định nghĩa các virtual fields cho PermissionTemplate model
 * @param {Object} schema - Schema của PermissionTemplate model
 */
const setupVirtuals = (schema) => {
  /**
   * Virtual field để lấy thông tin người tạo
   */
  schema.virtual('creator', {
    ref: 'User',
    localField: 'created_by',
    foreignField: '_id',
    justOne: true
  });

  /**
   * Virtual field để lấy thông tin người cập nhật cuối
   */
  schema.virtual('updater', {
    ref: 'User',
    localField: 'updated_by',
    foreignField: '_id',
    justOne: true
  });

  /**
   * Virtual field để lấy danh sách UserPermissions sử dụng template này
   */
  schema.virtual('user_permissions', {
    ref: 'UserPermission',
    localField: '_id',
    foreignField: 'template_id'
  });

  /**
   * Virtual field để format display name với category
   */
  schema.virtual('full_display_name').get(function() {
    return `[${this.category}] ${this.display_name}`;
  });

  /**
   * Virtual field để tạo slug từ name
   */
  schema.virtual('slug').get(function() {
    return this.name.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  });

  /**
   * Virtual field để lấy trạng thái dưới dạng text
   */
  schema.virtual('status_text').get(function() {
    return this.is_active ? 'Hoạt động' : 'Không hoạt động';
  });

  /**
   * Virtual field để lấy màu sắc trạng thái (cho UI)
   */
  schema.virtual('status_color').get(function() {
    return this.is_active ? 'green' : 'gray';
  });

  /**
   * Virtual field để format thời gian tạo
   */
  schema.virtual('created_at_formatted').get(function() {
    if (!this.createdAt) return null;
    
    return this.createdAt.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  /**
   * Virtual field để format thời gian cập nhật
   */
  schema.virtual('updated_at_formatted').get(function() {
    if (!this.updatedAt) return null;
    
    return this.updatedAt.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  /**
   * Virtual field để lấy icon với fallback
   */
  schema.virtual('display_icon').get(function() {
    return this.metadata?.icon || this.getDefaultIcon();
  });

  /**
   * Virtual field để lấy color với fallback
   */
  schema.virtual('display_color').get(function() {
    return this.metadata?.color || this.getDefaultColor();
  });

  /**
   * Virtual field để kiểm tra có dependencies không
   */
  schema.virtual('has_dependencies').get(function() {
    return this.dependencies && this.dependencies.length > 0;
  });

  /**
   * Virtual field để kiểm tra có conflicts không
   */
  schema.virtual('has_conflicts').get(function() {
    return this.conflicts && this.conflicts.length > 0;
  });

  /**
   * Virtual field để kiểm tra có thể hết hạn không
   */
  schema.virtual('expiry_text').get(function() {
    if (!this.can_expire) {
      return 'Vĩnh viễn';
    }
    
    if (this.default_expiry_days) {
      return `${this.default_expiry_days} ngày`;
    }
    
    return 'Tùy chỉnh';
  });

  /**
   * Virtual field để lấy summary cho tooltip
   */
  schema.virtual('summary').get(function() {
    const parts = [];
    
    parts.push(`Loại: ${this.type}`);
    parts.push(`Danh mục: ${this.category}`);
    
    if (this.has_dependencies) {
      parts.push(`Phụ thuộc: ${this.dependencies.length} permission(s)`);
    }
    
    if (this.has_conflicts) {
      parts.push(`Xung đột: ${this.conflicts.length} permission(s)`);
    }
    
    parts.push(`Trạng thái: ${this.status_text}`);
    
    return parts.join(' | ');
  });

  /**
   * Virtual field để lấy search text (cho client-side search)
   */
  schema.virtual('search_text').get(function() {
    const searchParts = [
      this.name,
      this.display_name,
      this.description,
      this.category,
      this.type,
      ...(this.tags || [])
    ];
    
    return searchParts.join(' ').toLowerCase();
  });
};

/**
 * Helper methods cho virtuals
 */
const setupVirtualHelpers = (schema) => {
  /**
   * Lấy icon mặc định theo type
   */
  schema.methods.getDefaultIcon = function() {
    const iconMap = {
      'feature': '🔧',
      'appearance': '🎨',
      'content': '📝',
      'interaction': '🤝',
      'system': '⚙️',
      'other': '📋'
    };
    
    return iconMap[this.type] || iconMap.other;
  };

  /**
   * Lấy màu mặc định theo type
   */
  schema.methods.getDefaultColor = function() {
    const colorMap = {
      'feature': '#3B82F6',      // Blue
      'appearance': '#8B5CF6',   // Purple
      'content': '#10B981',      // Green
      'interaction': '#F59E0B',  // Yellow
      'system': '#EF4444',       // Red
      'other': '#6B7280'         // Gray
    };
    
    return colorMap[this.type] || colorMap.other;
  };
};

module.exports = (schema) => {
  setupVirtuals(schema);
  setupVirtualHelpers(schema);
};
