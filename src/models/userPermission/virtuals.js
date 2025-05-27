/**
 * Định nghĩa các virtual fields cho UserPermission model
 * @param {Object} schema - Schema của UserPermission model
 */
const setupVirtuals = (schema) => {
  /**
   * Virtual field để lấy thông tin user
   */
  schema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });

  /**
   * Virtual field để lấy thông tin permission template
   */
  schema.virtual('template', {
    ref: 'PermissionTemplate',
    localField: 'template_id',
    foreignField: '_id',
    justOne: true
  });

  /**
   * Virtual field để lấy thông tin reference object (nếu có)
   */
  schema.virtual('reference', {
    ref: function() {
      // Xác định model reference dựa trên source
      switch (this.source) {
        case 'achievement':
          return 'Achievement';
        case 'level':
          return 'UserLevel';
        case 'purchase':
          return 'Transaction';
        default:
          return null;
      }
    },
    localField: 'reference_id',
    foreignField: '_id',
    justOne: true
  });

  /**
   * Virtual field để kiểm tra quyền có hết hạn không
   */
  schema.virtual('isExpired').get(function() {
    if (!this.expires_at) {
      return false;
    }
    return this.expires_at <= new Date();
  });

  /**
   * Virtual field để kiểm tra quyền có hiệu lực không
   */
  schema.virtual('isEffective').get(function() {
    return this.active && !this.isExpired;
  });

  /**
   * Virtual field để tính số ngày còn lại (nếu có hạn)
   */
  schema.virtual('daysRemaining').get(function() {
    if (!this.expires_at) {
      return null; // Vĩnh viễn
    }

    const now = new Date();
    const diffTime = this.expires_at - now;

    if (diffTime <= 0) {
      return 0; // Đã hết hạn
    }

    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  });

  /**
   * Virtual field để lấy trạng thái quyền dưới dạng text
   */
  schema.virtual('statusText').get(function() {
    if (!this.active) {
      return 'Đã vô hiệu hóa';
    }

    if (this.isExpired) {
      return 'Đã hết hạn';
    }

    if (this.expires_at) {
      const daysLeft = this.daysRemaining;
      if (daysLeft <= 7) {
        return `Sắp hết hạn (${daysLeft} ngày)`;
      }
      return `Còn hiệu lực (${daysLeft} ngày)`;
    }

    return 'Vĩnh viễn';
  });

  /**
   * Virtual field để lấy màu sắc trạng thái (cho UI)
   */
  schema.virtual('statusColor').get(function() {
    if (!this.active) {
      return 'gray';
    }

    if (this.isExpired) {
      return 'red';
    }

    if (this.expires_at) {
      const daysLeft = this.daysRemaining;
      if (daysLeft <= 3) {
        return 'red';
      } else if (daysLeft <= 7) {
        return 'orange';
      }
      return 'green';
    }

    return 'blue'; // Vĩnh viễn
  });

  /**
   * Virtual field để format thời gian cấp quyền
   */
  schema.virtual('grantedAtFormatted').get(function() {
    if (!this.granted_at) {
      return null;
    }

    return this.granted_at.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  /**
   * Virtual field để format thời gian hết hạn
   */
  schema.virtual('expiresAtFormatted').get(function() {
    if (!this.expires_at) {
      return 'Vĩnh viễn';
    }

    return this.expires_at.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  });
};

module.exports = setupVirtuals;
