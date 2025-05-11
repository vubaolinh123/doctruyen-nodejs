const express = require('express');
const router = express.Router();
const User = require('../../models/user');
const Transaction = require('../../models/Transaction');

/**
 * @route GET /api/admin/users/search
 * @desc Tìm kiếm người dùng
 * @access Private (Admin)
 */
router.get('/search', async (req, res) => {
  try {
    console.log('API received search request:', {
      query: req.query,
      headers: req.headers,
      auth: req.headers.authorization ? 'Bearer token received' : 'No auth token'
    });

    const { term } = req.query;

    // Nếu không có term, trả về mảng rỗng
    if (!term) {
      console.log('No search term provided');
      return res.json({
        success: true,
        users: []
      });
    }

    // Kiểm tra xem term có phải là email hay không
    const isEmail = term.includes('@');

    // Nếu term không phải là email và ngắn hơn 3 ký tự, không tìm kiếm
    if (!isEmail && term.length < 3) {
      console.log('Term is not email and less than 3 characters');
      return res.json({
        success: true,
        users: []
      });
    }

    console.log(`Searching users with term: ${term}, isEmail: ${isEmail}`);

    // Query điều kiện tìm kiếm
    let searchQuery;
    
    if (isEmail) {
      // Nếu là email, tìm chính xác hoặc tương tự
      searchQuery = {
        $or: [
          { email: term }, // Tìm chính xác email
          { email: { $regex: term, $options: 'i' } } // Tìm email có chứa term
        ]
      };
    } else {
      // Nếu không phải email, tìm theo tên hoặc email chứa term
      searchQuery = {
        $or: [
          { email: { $regex: term, $options: 'i' } },
          { name: { $regex: term, $options: 'i' } }
        ]
      };
    }

    // Tìm kiếm người dùng theo điều kiện
    const users = await User.find(searchQuery)
      .select('_id name email avatar coin coin_total coin_spent')
      .limit(10);

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
});

/**
 * @route GET /api/admin/users/:id/coins
 * @desc Lấy thông tin xu của người dùng
 * @access Private (Admin)
 */
router.get('/:id/coins', async (req, res) => {
  try {
    const { id } = req.params;

    // Tìm người dùng
    const user = await User.findById(id)
      .select('_id name email avatar coin coin_total coin_spent coin_stats');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Cập nhật thống kê xu nếu cần
    if (!user.coin_stats || !user.coin_stats.last_updated ||
        new Date() - new Date(user.coin_stats.last_updated) > 24 * 60 * 60 * 1000) {
      await user.updateCoinStats();
    }

    return res.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Error fetching user coin info:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
});

module.exports = router;
