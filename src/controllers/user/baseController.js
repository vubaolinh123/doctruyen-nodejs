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
 * Lấy slug của người dùng theo ID hoặc Google ID (API công khai)
 * @route GET /api/public/users/slug-only/:id
 * @access Public
 */
exports.getSlugById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Public API] Lấy slug của người dùng theo ID hoặc Google ID: ${id}`);

    // Kiểm tra xem id có phải là MongoDB ObjectId không
    const isValidObjectId = id.match(/^[0-9a-fA-F]{24}$/);

    // Kiểm tra xem id có phải là Google ID không (thường là chuỗi số dài)
    const isGoogleId = id.match(/^\d{20,22}$/);

    let user;

    if (isValidObjectId) {
      // Nếu là ObjectId hợp lệ, tìm theo ID
      console.log(`[Public API] Tìm người dùng theo MongoDB ObjectId: ${id}`);
      user = await userService.findById(id, { select: 'slug name email' });
    } else if (isGoogleId) {
      // Nếu là Google ID, tìm theo Google ID
      console.log(`[Public API] Tìm người dùng theo Google ID: ${id}`);
      user = await userService.findByGoogleId(id, { select: 'slug name email' });
    } else if (id.includes('@')) {
      // Nếu là email, tìm theo email
      console.log(`[Public API] Tìm người dùng theo email: ${id}`);
      user = await userService.findByEmail(id, { select: 'slug name email' });
    } else {
      // Nếu không phải các trường hợp trên, thử tìm theo slug
      console.log(`[Public API] Tìm người dùng theo slug: ${id}`);
      user = await userService.findBySlug(id, { select: 'slug name email' });

      // Nếu vẫn không tìm thấy, thử tìm theo Google ID một lần nữa
      // (trong trường hợp Google ID không khớp với pattern ở trên)
      if (!user) {
        console.log(`[Public API] Thử tìm người dùng theo Google ID (fallback): ${id}`);
        user = await userService.findByGoogleId(id, { select: 'slug name email' });
      }
    }

    if (!user) {
      console.log(`[Public API] Không tìm thấy người dùng với ID/Google ID/slug: ${id}`);
      return res.status(200).json({
        success: false,
        message: 'Không tìm thấy người dùng',
        slug: '',
        data: null
      });
    }

    console.log(`[Public API] Đã tìm thấy người dùng: ${user.name}, slug: ${user.slug}`);
    return res.json({
      success: true,
      message: 'Tìm thấy người dùng',
      data: {
        _id: user._id,
        slug: user.slug,
        name: user.name
      },
      slug: user.slug || ''
    });
  } catch (error) {
    console.error('[Public API] Lỗi khi lấy slug của người dùng:', error);

    // Trả về status 200 với thông báo lỗi để tránh lỗi 500 ở client
    return res.status(200).json({
      success: false,
      message: 'Lỗi khi lấy slug của người dùng',
      error: error.message || 'Internal Server Error',
      slug: '',
      data: null
    });
  }
};