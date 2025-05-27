/**
 * Định nghĩa các static methods cho PermissionTemplate model
 * @param {Object} schema - Schema của PermissionTemplate model
 */
const setupStatics = (schema) => {
  /**
   * Tìm template theo tên
   * @param {string} name - Tên template
   * @returns {Promise<Object|null>} - Template tìm thấy hoặc null
   */
  schema.statics.findByName = function(name) {
    return this.findOne({ name: name.toLowerCase().trim() });
  };

  /**
   * Lấy danh sách templates đang hoạt động
   * @param {Object} options - Tùy chọn lọc
   * @returns {Promise<Array>} - Danh sách templates
   */
  schema.statics.getActiveTemplates = function(options = {}) {
    const query = { is_active: true };

    // Lọc theo category
    if (options.category) {
      query.category = options.category;
    }

    // Lọc theo type
    if (options.type) {
      query.type = options.type;
    }

    return this.find(query)
      .sort({ priority: -1, display_name: 1 })
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email');
  };

  /**
   * Tìm kiếm templates
   * @param {Object} searchOptions - Tùy chọn tìm kiếm
   * @returns {Promise<Object>} - Kết quả tìm kiếm với pagination
   */
  schema.statics.searchTemplates = async function(searchOptions = {}) {
    const {
      search = '',
      category = '',
      type = '',
      is_active = null,
      tags = [],
      page = 1,
      limit = 10,
      sort = 'priority'
    } = searchOptions;

    // Xây dựng query
    const query = {};

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by type
    if (type) {
      query.type = type;
    }

    // Filter by active status
    if (is_active !== null) {
      query.is_active = is_active;
    }

    // Filter by tags
    if (tags.length > 0) {
      query.tags = { $in: tags };
    }

    // Xây dựng sort
    let sortQuery = {};
    switch (sort) {
      case 'name':
        sortQuery = { display_name: 1 };
        break;
      case 'category':
        sortQuery = { category: 1, display_name: 1 };
        break;
      case 'created':
        sortQuery = { createdAt: -1 };
        break;
      case 'updated':
        sortQuery = { updatedAt: -1 };
        break;
      case 'priority':
      default:
        sortQuery = { priority: -1, display_name: 1 };
        break;
    }

    // Thêm text score nếu có text search
    if (search) {
      sortQuery.score = { $meta: 'textScore' };
    }

    // Thực hiện query
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .populate('created_by', 'name email')
        .populate('updated_by', 'name email'),
      this.countDocuments(query)
    ]);

    return {
      items,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      limit,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    };
  };

  /**
   * Lấy danh sách categories
   * @returns {Promise<Array>} - Danh sách categories
   */
  schema.statics.getCategories = function() {
    return this.distinct('category', { is_active: true });
  };

  /**
   * Lấy danh sách tags
   * @returns {Promise<Array>} - Danh sách tags
   */
  schema.statics.getTags = function() {
    return this.distinct('tags', { is_active: true });
  };

  /**
   * Lấy thống kê templates
   * @returns {Promise<Object>} - Thống kê
   */
  schema.statics.getStats = async function() {
    const [
      totalTemplates,
      activeTemplates,
      categoriesStats,
      typesStats
    ] = await Promise.all([
      this.countDocuments(),
      this.countDocuments({ is_active: true }),
      this.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      this.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    return {
      total: totalTemplates,
      active: activeTemplates,
      inactive: totalTemplates - activeTemplates,
      categories: categoriesStats,
      types: typesStats
    };
  };

  /**
   * Tạo template mới với validation
   * @param {Object} templateData - Dữ liệu template
   * @param {string} createdBy - ID người tạo
   * @returns {Promise<Object>} - Template đã tạo
   */
  schema.statics.createTemplate = async function(templateData, createdBy) {
    // Kiểm tra tên đã tồn tại chưa
    const existingTemplate = await this.findByName(templateData.name);
    if (existingTemplate) {
      throw new Error('Tên permission đã tồn tại');
    }

    // Validate dependencies và conflicts
    if (templateData.dependencies && templateData.dependencies.length > 0) {
      const dependencyTemplates = await this.find({
        name: { $in: templateData.dependencies },
        is_active: true
      });

      if (dependencyTemplates.length !== templateData.dependencies.length) {
        throw new Error('Một số dependencies không tồn tại hoặc không hoạt động');
      }
    }

    if (templateData.conflicts && templateData.conflicts.length > 0) {
      const conflictTemplates = await this.find({
        name: { $in: templateData.conflicts },
        is_active: true
      });

      if (conflictTemplates.length !== templateData.conflicts.length) {
        throw new Error('Một số conflicts không tồn tại hoặc không hoạt động');
      }
    }

    // Tạo template
    return this.create({
      ...templateData,
      name: templateData.name.toLowerCase().trim(),
      created_by: createdBy,
      updated_by: createdBy
    });
  };

  /**
   * Cập nhật template với validation
   * @param {string} templateId - ID template
   * @param {Object} updateData - Dữ liệu cập nhật
   * @param {string} updatedBy - ID người cập nhật
   * @returns {Promise<Object>} - Template đã cập nhật
   */
  schema.statics.updateTemplate = async function(templateId, updateData, updatedBy) {
    const template = await this.findById(templateId);
    if (!template) {
      throw new Error('Không tìm thấy template');
    }

    // Kiểm tra tên mới nếu có thay đổi
    if (updateData.name && updateData.name.toLowerCase().trim() !== template.name) {
      const existingTemplate = await this.findByName(updateData.name);
      if (existingTemplate) {
        throw new Error('Tên permission đã tồn tại');
      }
    }

    // Validate dependencies và conflicts nếu có thay đổi
    if (updateData.dependencies) {
      const dependencyTemplates = await this.find({
        name: { $in: updateData.dependencies },
        is_active: true,
        _id: { $ne: templateId } // Không bao gồm chính nó
      });

      if (dependencyTemplates.length !== updateData.dependencies.length) {
        throw new Error('Một số dependencies không tồn tại hoặc không hoạt động');
      }
    }

    if (updateData.conflicts) {
      const conflictTemplates = await this.find({
        name: { $in: updateData.conflicts },
        is_active: true,
        _id: { $ne: templateId } // Không bao gồm chính nó
      });

      if (conflictTemplates.length !== updateData.conflicts.length) {
        throw new Error('Một số conflicts không tồn tại hoặc không hoạt động');
      }
    }

    // Cập nhật template
    Object.assign(template, {
      ...updateData,
      name: updateData.name ? updateData.name.toLowerCase().trim() : template.name,
      updated_by: updatedBy
    });

    return template.save();
  };

  /**
   * Xóa template (soft delete bằng cách set is_active = false)
   * @param {string} templateId - ID template
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.statics.deleteTemplate = async function(templateId) {
    const template = await this.findById(templateId);
    if (!template) {
      throw new Error('Không tìm thấy template');
    }

    // Kiểm tra xem template có đang được sử dụng không
    const isInUse = await template.isInUse();
    if (isInUse) {
      // Soft delete
      template.is_active = false;
      await template.save();
      return { deleted: false, deactivated: true, template };
    } else {
      // Hard delete
      await this.findByIdAndDelete(templateId);
      return { deleted: true, deactivated: false, template };
    }
  };

  /**
   * Bulk operations
   * @param {Array} operations - Danh sách operations
   * @param {string} operatedBy - ID người thực hiện
   * @returns {Promise<Object>} - Kết quả bulk operations
   */
  schema.statics.bulkOperations = async function(operations, operatedBy) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'activate':
            await this.findByIdAndUpdate(operation.id, {
              is_active: true,
              updated_by: operatedBy
            });
            break;
          case 'deactivate':
            await this.findByIdAndUpdate(operation.id, {
              is_active: false,
              updated_by: operatedBy
            });
            break;
          case 'delete':
            await this.deleteTemplate(operation.id);
            break;
          case 'updateCategory':
            await this.findByIdAndUpdate(operation.id, {
              category: operation.data.category,
              updated_by: operatedBy
            });
            break;
        }
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          id: operation.id,
          error: error.message
        });
      }
    }

    return results;
  };
};

module.exports = setupStatics;
