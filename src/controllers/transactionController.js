const Transaction = require('../models/Transaction');

exports.getAll = async (req, res) => {
  try {

    const { customers_id, type, search = '', page = 1, limit = 10, sort = '-createdAt' } = req.query;
    const query = {};

    // Nếu người dùng đã đăng nhập, lấy giao dịch của họ
    if (req.user && req.user.id) {
      query.customer_id = req.user.id;
    }
    // Nếu có tham số customers_id, sử dụng nó (cho admin)
    else if (customers_id) {
      query.customer_id = customers_id;
    }
    // Nếu không có thông tin người dùng, trả về lỗi
    else {
      console.error('No user information found');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. User information is required.'
      });
    }

    // Thêm các điều kiện lọc khác
    if (type) {
      query.type = type;
    }
    if (search) {
      query.description = { $regex: search, $options: 'i' };
    }

    // Đếm tổng số giao dịch thỏa mãn điều kiện
    const total = await Transaction.countDocuments(query);

    // Lấy danh sách giao dịch với phân trang
    const items = await Transaction.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Trả về kết quả với thông tin phân trang
    const result = {
      success: true,
      items,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const item = await Transaction.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Kiểm tra quyền truy cập - chỉ cho phép người dùng xem giao dịch của họ hoặc admin
    if (req.user && (req.user.id.toString() === item.customer_id.toString() || req.user.role === 'admin')) {
      return res.json({
        success: true,
        data: item
      });
    } else {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this transaction'
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.create = async (req, res) => {
  try {
    // Đảm bảo customer_id được thiết lập từ người dùng đăng nhập
    if (req.user && req.user.id) {
      req.body.customer_id = req.user.id;
    } else if (!req.body.customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }

    // Tạo mã giao dịch duy nhất nếu chưa có
    if (!req.body.transaction_id) {
      const type = req.body.type || 'other';
      req.body.transaction_id = `${type.toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    // Sử dụng phương thức tĩnh để tạo giao dịch
    const item = await Transaction.createTransaction(req.body);

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

exports.update = async (req, res) => {
  try {
    // Tìm giao dịch trước khi cập nhật
    const existingItem = await Transaction.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Kiểm tra quyền - chỉ admin mới có thể cập nhật giao dịch
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can update transactions'
      });
    }

    // Không cho phép thay đổi customer_id
    if (req.body.customer_id && req.body.customer_id.toString() !== existingItem.customer_id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change the customer of a transaction'
      });
    }

    // Cập nhật giao dịch
    const item = await Transaction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      data: item
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

exports.remove = async (req, res) => {
  try {
    // Tìm giao dịch trước khi xóa
    const existingItem = await Transaction.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Kiểm tra quyền - chỉ admin mới có thể xóa giao dịch
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can delete transactions'
      });
    }

    // Xóa giao dịch
    await Transaction.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};