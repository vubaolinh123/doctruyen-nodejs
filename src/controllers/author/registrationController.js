const authorRegistrationService = require('../../services/author/authorRegistrationService');

/**
 * Controller xử lý đăng ký tác giả
 */

/**
 * Đăng ký user hiện tại thành tác giả
 * @route POST /api/authors/register
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.registerAsAuthor = async (req, res) => {
  try {
    // Lấy user ID từ token (đã được xác thực bởi middleware)
    const userId = req.user.id;
    const { authorName } = req.body;

    const result = await authorRegistrationService.registerAsAuthor(userId, {
      authorName
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Lỗi khi đăng ký tác giả:', error);
    
    // Xử lý các lỗi cụ thể
    if (error.message.includes('Không đủ điều kiện')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Không đủ xu')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message === 'Không tìm thấy user') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin user'
      });
    }

    if (error.message.includes('đã được sử dụng')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('đã có author record')) {
      return res.status(409).json({
        success: false,
        message: 'User đã là tác giả'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy thông tin đăng ký tác giả của user hiện tại
 * @route GET /api/authors/register/info
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRegistrationInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await authorRegistrationService.getRegistrationInfo(userId);

    return res.json({
      success: true,
      message: 'Lấy thông tin đăng ký thành công',
      data: result
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin đăng ký tác giả:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy lịch sử đăng ký tác giả (Admin only)
 * @route GET /api/authors/register/history
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRegistrationHistory = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem lịch sử đăng ký'
      });
    }

    const { page, limit, startDate, endDate } = req.query;

    const result = await authorRegistrationService.getRegistrationHistory({
      page,
      limit,
      startDate,
      endDate
    });

    return res.json({
      success: true,
      message: 'Lấy lịch sử đăng ký thành công',
      ...result
    });
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử đăng ký tác giả:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Lấy thống kê đăng ký tác giả (Admin only)
 * @route GET /api/authors/register/stats
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getRegistrationStats = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem thống kê'
      });
    }

    const stats = await authorRegistrationService.getRegistrationStats();

    return res.json({
      success: true,
      message: 'Lấy thống kê thành công',
      data: stats
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê đăng ký tác giả:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};

/**
 * Admin đăng ký user thành tác giả (bỏ qua điều kiện)
 * @route POST /api/authors/register/admin/:userId
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.adminRegisterUser = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể thực hiện chức năng này'
      });
    }

    const { userId } = req.params;
    const { authorName, skipFee } = req.body;

    // Admin có thể bỏ qua phí đăng ký
    if (skipFee) {
      // Tạo author record trực tiếp mà không trừ xu
      const User = require('../../models/user');
      const Author = require('../../models/author');
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy user'
        });
      }

      // Kiểm tra xem user đã là author chưa
      const existingAuthor = await Author.userHasAuthorRecord(userId);
      if (existingAuthor) {
        return res.status(409).json({
          success: false,
          message: 'User đã là tác giả'
        });
      }

      const authorData = {
        name: authorName || user.name,
        authorType: 'system',
        userId: userId,
        status: true
      };
      
      const author = new Author(authorData);
      await author.save();

      // Cập nhật role user
      await User.findByIdAndUpdate(userId, { role: 'author' });

      return res.status(201).json({
        success: true,
        message: 'Admin đăng ký tác giả thành công (miễn phí)',
        data: {
          author: {
            id: author._id,
            name: author.name,
            slug: author.slug,
            authorType: author.authorType,
            userId: author.userId,
            createdAt: author.createdAt
          },
          user: {
            id: user._id,
            name: user.name,
            role: 'author'
          }
        }
      });
    } else {
      // Đăng ký bình thường với phí
      const result = await authorRegistrationService.registerAsAuthor(userId, {
        authorName
      });

      return res.status(201).json(result);
    }
  } catch (error) {
    console.error('Lỗi khi admin đăng ký tác giả:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ'
    });
  }
};
