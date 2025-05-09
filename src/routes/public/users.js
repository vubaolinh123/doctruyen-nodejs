const express = require('express');
const router = express.Router();
const customerController = require('../../controllers/customerController');
const auth = require('../../middleware/auth');
const Customer = require('../../models/Customer');

// Route công khai để lấy thông tin người dùng theo slug
// Middleware auth là optional - nếu có token thì sẽ kiểm tra xem có phải profile của chính họ không
router.get('/slug/:slug', auth.optional, customerController.getBySlug);

// Route công khai chỉ trả về trường slug của người dùng theo ID
router.get('/slug-only/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Tìm người dùng theo ID và chỉ lấy trường slug
    const user = await Customer.findById(id).select('slug');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        slug: ''
      });
    }

    // Trả về slug
    res.json({
      success: true,
      slug: user.slug || ''
    });
  } catch (error) {
    console.error('Error fetching user slug:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user slug',
      slug: ''
    });
  }
});

module.exports = router;
