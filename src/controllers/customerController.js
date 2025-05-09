const Customer = require('../models/Customer');

// Hàm lọc thông tin người dùng để trả về cho API public
const filterPublicUserData = (user) => {
  if (!user) return null;

  // Chỉ trả về các thông tin công khai
  return {
    id: user._id,
    name: user.name,
    slug: user.slug,
    avatar: user.avatar,
    banner: user.banner,
    role: user.role,
    created_at: user.createdAt,
    // Thêm các trường khác nếu cần
  };
};

// Hàm lọc thông tin người dùng cho người dùng đã đăng nhập xem profile của chính họ
const filterPrivateUserData = (user) => {
  if (!user) return null;

  // Trả về thông tin đầy đủ hơn cho chủ tài khoản
  return {
    id: user._id,
    name: user.name,
    slug: user.slug,
    email: user.email,
    avatar: user.avatar,
    banner: user.banner,
    gender: user.gender,
    birthday: user.birthday,
    role: user.role,
    accountType: user.accountType,
    coin: user.coin,
    coin_total: user.coin_total,
    coin_spent: user.coin_spent,
    attendance_summary: user.attendance_summary,
    created_at: user.createdAt,
    // Thêm các trường khác nếu cần
  };
};

exports.getAll = async (req, res) => {
  try {
    const { search = '', role, page = 1, limit = 10, sort = '-createdAt' } = req.query;
    const query = {};

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await Customer.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const item = await Customer.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const item = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await Customer.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy thông tin người dùng theo slug
exports.getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    // Tìm người dùng theo slug
    const user = await Customer.findBySlug(slug);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Kiểm tra xem người dùng đang xem có phải là chính họ không
    let isOwnProfile = false;

    // Nếu có thông tin người dùng đã đăng nhập từ middleware auth
    if (req.user && req.user.id) {
      isOwnProfile = req.user.id.toString() === user._id.toString();
    }

    // Trả về dữ liệu tùy theo loại người dùng
    const userData = isOwnProfile ? filterPrivateUserData(user) : filterPublicUserData(user);

    res.json({
      success: true,
      isOwnProfile,
      user: userData
    });
  } catch (err) {
    console.error('Error fetching user by slug:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin người dùng',
      error: err.message
    });
  }
};
