const userService = require('../../services/user/userService');

/**
 * Lấy danh sách tất cả người dùng
 * @route GET /api/users
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAll = async (req, res) => {
  try {
    const { search, role, page, limit, sort } = req.query;
    const result = await userService.getAllUsers({
      search,
      role,
      page,
      limit,
      sort
    });

    res.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        limit: result.limit
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy người dùng theo ID
 * @route GET /api/users/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Lỗi khi lấy người dùng theo ID:', error);

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
 * Tạo người dùng mới
 * @route POST /api/users
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.create = async (req, res) => {
  try {
    const user = await userService.createUser(req.body);

    res.status(201).json({
      success: true,
      message: 'Tạo người dùng thành công',
      data: user
    });
  } catch (error) {
    console.error('Lỗi khi tạo người dùng:', error);

    // Xử lý lỗi trùng lặp email
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Cập nhật thông tin người dùng
 * @route PUT /api/users/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.update = async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Cập nhật người dùng thành công',
      data: user
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật người dùng:', error);

    if (error.message === 'Không tìm thấy người dùng') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Xử lý lỗi trùng lặp email
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Xóa người dùng
 * @route DELETE /api/users/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.remove = async (req, res) => {
  try {
    await userService.deleteUser(req.params.id);

    res.json({
      success: true,
      message: 'Xóa người dùng thành công'
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
 * Lấy thông tin người dùng theo slug (API công khai)
 * @route GET /api/public/users/slug/:slug
 * @access Public (Optional Auth)
 */
exports.getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`[Public API] Lấy thông tin người dùng theo slug: ${slug}`);

    const user = await userService.findBySlug(slug);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Xác định xem người dùng đang gọi API có đang xem profile của chính họ không
    const isOwnProfile = req.user && req.user._id.toString() === user._id.toString();

    // Chuẩn bị dữ liệu trả về, ẩn các thông tin nhạy cảm
    const userData = {
      _id: user._id,
      name: user.name,
      slug: user.slug,
      avatar: user.avatar,
      level: user.level,
      exp: user.exp,
      joinDate: user.createdAt,
      bio: user.bio || '',
      stats: user.stats || {}
    };

    // Nếu là profile của chính họ, trả về thêm thông tin
    if (isOwnProfile) {
      userData.email = user.email;
      userData.coin = user.coin;
      userData.phone = user.phone;
      userData.settings = user.settings;
    }

    return res.json({
      success: true,
      data: userData,
      isOwnProfile
    });
  } catch (error) {
    console.error('[Public API] Lỗi khi lấy thông tin người dùng theo slug:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
};

/**
 * Lấy slug của người dùng theo ID (API công khai)
 * @route GET /api/public/users/slug-only/:id
 * @access Public
 */
exports.getSlugById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Public API] Lấy slug của người dùng theo ID: ${id}`);

    const user = await userService.findById(id, { select: 'slug' });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    return res.json({
      success: true,
      data: {
        _id: user._id,
        slug: user.slug
      }
    });
  } catch (error) {
    console.error('[Public API] Lỗi khi lấy slug của người dùng theo ID:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
};