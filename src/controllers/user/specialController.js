const userService = require('../../services/user/userService');
const User = require('../../models/user');

/**
 * Lấy thông tin người dùng theo slug
 * @route GET /api/users/slug/:slug
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Tìm người dùng theo slug
    const user = await userService.getUserBySlug(slug);
    
    // Kiểm tra xem người dùng đang xem có phải là chính họ không
    let isOwnProfile = false;
    
    // Nếu có thông tin người dùng đã đăng nhập từ middleware auth
    if (req.user && req.user.id) {
      isOwnProfile = req.user.id.toString() === user._id.toString();
    }
    
    // Trả về dữ liệu tùy theo loại người dùng
    const userData = isOwnProfile 
      ? userService.filterPrivateUserData(user) 
      : userService.filterPublicUserData(user);
    
    res.json({
      success: true,
      isOwnProfile,
      user: userData
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin người dùng theo slug:', error);
    
    if (error.message === 'Không tìm thấy người dùng') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin người dùng',
      error: error.message
    });
  }
};

/**
 * Lấy slug của người dùng theo ID
 * @route GET /api/users/slug-only/:id
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getSlugById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID người dùng là bắt buộc',
        slug: ''
      });
    }
    
    // Tìm người dùng theo ID và chỉ lấy trường slug
    const user = await User.findById(id).select('slug');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
        slug: ''
      });
    }
    
    // Trả về slug
    res.json({
      success: true,
      slug: user.slug || ''
    });
  } catch (error) {
    console.error('Lỗi khi lấy slug của người dùng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy slug của người dùng',
      slug: ''
    });
  }
};

/**
 * Tìm kiếm người dùng
 * @route GET /api/admin/users/search
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @access Private (Admin)
 */
exports.searchUsers = async (req, res) => {
  try {
    console.log('API received search request:', {
      query: req.query,
      headers: req.headers,
      auth: req.headers.authorization ? 'Bearer token received' : 'No auth token'
    });

    const { term } = req.query;

    const users = await userService.searchUsers(term);
    
    console.log(`Found ${users.length} users matching "${term}"`);
    if(users.length > 0) {
      console.log('First user:', {
        id: users[0]._id,
        name: users[0].name,
        email: users[0].email
      });
    }

    return res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};

/**
 * Lấy thông tin xu của người dùng
 * @route GET /api/admin/users/:id/coins
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @access Private (Admin)
 */
exports.getUserCoins = async (req, res) => {
  try {
    const { id } = req.params;

    try {
      const user = await userService.getUserCoinInfo(id);
      
      return res.json({
        success: true,
        user: user
      });
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('Error fetching user coin info:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
}; 