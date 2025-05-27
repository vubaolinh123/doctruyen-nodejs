/**
 * Controller xử lý các chức năng quản lý Permission Templates
 */
const PermissionTemplate = require('../../models/permissionTemplate');
const { handleError, createError } = require('../../utils/errorHandler');

/**
 * Lấy danh sách permission templates
 * GET /api/admin/permission-templates
 */
exports.getTemplates = async (req, res) => {
  try {
    const {
      search = '',
      category = '',
      type = '',
      is_active = null,
      tags = '',
      page = 1,
      limit = 10,
      sort = 'priority'
    } = req.query;

    // Parse tags
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    // Parse is_active
    let activeFilter = null;
    if (is_active === 'true') activeFilter = true;
    else if (is_active === 'false') activeFilter = false;

    const searchOptions = {
      search,
      category,
      type,
      is_active: activeFilter,
      tags: tagsArray,
      page: parseInt(page),
      limit: parseInt(limit),
      sort
    };

    const result = await PermissionTemplate.searchTemplates(searchOptions);

    return res.json({
      success: true,
      data: result.items,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        total: result.total,
        limit: result.limit,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev
      }
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Lấy thông tin chi tiết một permission template
 * GET /api/admin/permission-templates/:id
 */
exports.getTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await PermissionTemplate.findById(id)
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy permission template'
      });
    }

    const details = await template.getDetails();

    return res.json({
      success: true,
      data: {
        ...details,
        created_by: template.created_by,
        updated_by: template.updated_by
      }
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Tạo permission template mới
 * POST /api/admin/permission-templates
 */
exports.createTemplate = async (req, res) => {
  try {
    const templateData = req.body;

    // Validate required fields
    const requiredFields = ['name', 'display_name', 'description', 'category'];
    for (const field of requiredFields) {
      if (!templateData[field]) {
        return res.status(400).json({
          success: false,
          message: `Trường ${field} là bắt buộc`
        });
      }
    }

    const template = await PermissionTemplate.createTemplate(templateData, req.user.id);

    return res.status(201).json({
      success: true,
      message: 'Tạo permission template thành công',
      data: await template.getDetails()
    });
  } catch (error) {
    if (error.message.includes('đã tồn tại')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    return handleError(res, error);
  }
};

/**
 * Cập nhật permission template
 * PUT /api/admin/permission-templates/:id
 */
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const template = await PermissionTemplate.updateTemplate(id, updateData, req.user.id);

    return res.json({
      success: true,
      message: 'Cập nhật permission template thành công',
      data: await template.getDetails()
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    if (error.message.includes('đã tồn tại')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    return handleError(res, error);
  }
};

/**
 * Xóa permission template
 * DELETE /api/admin/permission-templates/:id
 */
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await PermissionTemplate.deleteTemplate(id);

    if (result.deleted) {
      return res.json({
        success: true,
        message: 'Xóa permission template thành công'
      });
    } else {
      return res.json({
        success: true,
        message: 'Permission template đang được sử dụng, đã vô hiệu hóa thay vì xóa',
        data: { deactivated: true }
      });
    }
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    return handleError(res, error);
  }
};

/**
 * Kích hoạt/vô hiệu hóa permission template
 * PUT /api/admin/permission-templates/:id/toggle-status
 */
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await PermissionTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy permission template'
      });
    }

    template.is_active = !template.is_active;
    template.updated_by = req.user.id;
    await template.save();

    return res.json({
      success: true,
      message: `${template.is_active ? 'Kích hoạt' : 'Vô hiệu hóa'} permission template thành công`,
      data: { is_active: template.is_active }
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Lấy danh sách categories
 * GET /api/admin/permission-templates/categories
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = await PermissionTemplate.getCategories();

    return res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Lấy danh sách tags
 * GET /api/admin/permission-templates/tags
 */
exports.getTags = async (req, res) => {
  try {
    const tags = await PermissionTemplate.getTags();

    return res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Lấy thống kê permission templates
 * GET /api/admin/permission-templates/stats
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await PermissionTemplate.getStats();

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bulk operations
 * POST /api/admin/permission-templates/bulk
 */
exports.bulkOperations = async (req, res) => {
  try {
    const { operations } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        message: 'Operations phải là một mảng'
      });
    }

    const result = await PermissionTemplate.bulkOperations(operations, req.user.id);

    return res.json({
      success: true,
      message: `Hoàn thành bulk operations: ${result.success} thành công, ${result.failed} thất bại`,
      data: result
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Lấy danh sách users đang sử dụng template
 * GET /api/admin/permission-templates/:id/users
 */
exports.getTemplateUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const template = await PermissionTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy permission template'
      });
    }

    const users = await template.getUsers({
      page: parseInt(page),
      limit: parseInt(limit)
    });

    const usageCount = await template.getUsageCount();

    return res.json({
      success: true,
      data: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(usageCount / parseInt(limit)),
        total: usageCount,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    return handleError(res, error);
  }
};
