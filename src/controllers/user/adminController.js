const userService = require('../../services/user/userService');

/**
 * Lấy thống kê người dùng cho admin
 * @route GET /api/users/stats
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getUserStats = async (req, res) => {
  try {
    const stats = await userService.getUserStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê người dùng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy danh sách người dùng với phân trang và bộ lọc nâng cao cho admin
 * @route GET /api/users
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAllUsersAdmin = async (req, res) => {
  try {
    const {
      search,
      role,
      status,
      accountType,
      emailVerified,
      page = 1,
      limit = 100,
      sort = 'createdAt',
      order = 'desc',
      registrationDateFrom,
      registrationDateTo,
      lastActiveDateFrom,
      lastActiveDateTo,
      coinMin,
      coinMax
    } = req.query;



    const result = await userService.getAllUsersAdmin({
      search,
      role,
      status,
      accountType,
      emailVerified: emailVerified === 'true' ? true : emailVerified === 'false' ? false : undefined,
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      order,
      registrationDateFrom,
      registrationDateTo,
      lastActiveDateFrom,
      lastActiveDateTo,
      coinMin: coinMin ? parseInt(coinMin) : undefined,
      coinMax: coinMax ? parseInt(coinMax) : undefined
    });

    res.json({
      success: true,
      data: {
        items: result.users,
        total: result.total,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        limit: result.limit
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng admin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Cập nhật trạng thái người dùng
 * @route PUT /api/users/:id/status
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;



    if (!['active', 'inactive', 'banned'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ'
      });
    }

    const user = await userService.updateUserStatus(id, status);

    res.json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: user
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái người dùng:', error);

    if (error.message === 'Không tìm thấy người dùng') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Cập nhật vai trò người dùng
 * @route PUT /api/users/:id/role
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;



    if (!['user', 'author', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Vai trò không hợp lệ'
      });
    }

    const user = await userService.updateUserRole(id, role);

    res.json({
      success: true,
      message: 'Cập nhật vai trò thành công',
      data: user
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật vai trò người dùng:', error);

    if (error.message === 'Không tìm thấy người dùng') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Thực hiện thao tác hàng loạt trên người dùng
 * @route POST /api/admin/users/bulk
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.bulkUserOperations = async (req, res) => {
  try {
    const { userIds, operation, data } = req.body;

    console.log(`[AdminController] Bulk operation request: ${operation} for ${userIds?.length} users`);

    // Validation
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Danh sách ID người dùng không hợp lệ'
      });
    }

    // Validate operation
    const validOperations = ['delete', 'activate', 'deactivate', 'ban', 'setUser', 'setAuthor', 'setAdmin'];
    if (!validOperations.includes(operation)) {
      return res.status(400).json({
        success: false,
        message: `Thao tác không hợp lệ. Các thao tác được hỗ trợ: ${validOperations.join(', ')}`
      });
    }

    // Check admin permissions
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể thực hiện thao tác này'
      });
    }

    // Prevent admin from deleting themselves
    if (operation === 'delete' && userIds.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa tài khoản của chính mình'
      });
    }

    const result = await userService.bulkUserOperations(userIds, operation, data);

    res.json({
      success: true,
      message: `Thực hiện thao tác ${operation} thành công cho ${result.success}/${result.total} người dùng`,
      data: result
    });
  } catch (error) {
    console.error('Lỗi khi thực hiện thao tác hàng loạt:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy thông tin preview về dữ liệu sẽ bị xóa
 * @route GET /api/admin/users/:id/deletion-preview
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getUserDeletionPreview = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[AdminController] Getting deletion preview for user ${id}`);

    // Check admin permissions
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem thông tin này'
      });
    }

    const preview = await userService.getUserDeletionPreview(id);

    res.json({
      success: true,
      message: 'Lấy thông tin preview thành công',
      data: preview
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin preview:', error);

    if (error.message === 'Không tìm thấy người dùng') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Xóa người dùng (admin) với thông tin chi tiết
 * @route DELETE /api/admin/users/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[AdminController] Delete user request for ${id}`);

    // Check admin permissions
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xóa người dùng'
      });
    }

    // Prevent admin from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa tài khoản của chính mình'
      });
    }

    const deletionSummary = await userService.deleteUser(id);

    res.json({
      success: true,
      message: 'Xóa người dùng thành công',
      data: deletionSummary
    });
  } catch (error) {
    console.error('Lỗi khi xóa người dùng:', error);

    if (error.message === 'Không tìm thấy người dùng') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Xóa hàng loạt người dùng (admin)
 * @route DELETE /api/admin/users/bulk
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.bulkDeleteUsers = async (req, res) => {
  try {
    const { userIds } = req.body;

    console.log(`[AdminController] Bulk delete request for ${userIds?.length} users`);

    // Validation
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Danh sách ID người dùng không hợp lệ'
      });
    }

    // Check admin permissions
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xóa người dùng'
      });
    }

    // Prevent admin from deleting themselves
    if (userIds.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa tài khoản của chính mình'
      });
    }

    const result = await userService.bulkDeleteUsers(userIds);

    res.json({
      success: true,
      message: `Xóa hàng loạt hoàn thành: ${result.success}/${result.total} người dùng đã được xóa`,
      data: result
    });
  } catch (error) {
    console.error('Lỗi khi xóa hàng loạt người dùng:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ nội bộ'
    });
  }
};
