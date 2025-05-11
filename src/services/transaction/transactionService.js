const Transaction = require('../../models/transaction');

/**
 * Service xử lý logic nghiệp vụ cho giao dịch
 */
class TransactionService {
  /**
   * Lấy tất cả giao dịch theo điều kiện
   */
  async getAll(params, userId, userRole) {
    const { customers_id, type, search = '', page = 1, limit = 10, sort = '-createdAt' } = params;
    const query = {};

    // Nếu người dùng đã đăng nhập, lấy giao dịch của họ
    if (userId) {
      query.user_id = userId;
    }
    // Nếu có tham số customers_id và là admin, sử dụng nó
    else if (customers_id && userRole === 'admin') {
      query.user_id = customers_id;
    }
    // Nếu không có thông tin người dùng, trả về lỗi
    else {
      throw new Error('Unauthorized. User information is required.');
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
    return {
      success: true,
      items,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    };
  }

  /**
   * Lấy thông tin giao dịch theo ID
   */
  async getById(id, userId, userRole) {
    const item = await Transaction.findById(id);
    
    if (!item) {
      throw new Error('Transaction not found');
    }

    // Kiểm tra quyền truy cập - chỉ cho phép người dùng xem giao dịch của họ hoặc admin
    if (userId.toString() === item.user_id.toString() || userRole === 'admin') {
      return {
        success: true,
        data: item
      };
    } else {
      throw new Error('You do not have permission to view this transaction');
    }
  }

  /**
   * Tạo mới giao dịch
   */
  async create(data, userId) {
    // Đảm bảo user_id được thiết lập từ người dùng đăng nhập
    if (userId) {
      data.user_id = userId;
    } else if (!data.user_id) {
      throw new Error('User ID is required');
    }

    // Tạo mã giao dịch duy nhất nếu chưa có
    if (!data.transaction_id) {
      const type = data.type || 'other';
      data.transaction_id = `${type.toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    // Sử dụng phương thức tĩnh để tạo giao dịch
    const item = await Transaction.createTransaction(data);

    return {
      success: true,
      data: item
    };
  }

  /**
   * Cập nhật thông tin giao dịch
   */
  async update(id, data, userRole) {
    // Tìm giao dịch trước khi cập nhật
    const existingItem = await Transaction.findById(id);
    
    if (!existingItem) {
      throw new Error('Transaction not found');
    }

    // Kiểm tra quyền - chỉ admin mới có thể cập nhật giao dịch
    if (userRole !== 'admin') {
      throw new Error('Only administrators can update transactions');
    }

    // Không cho phép thay đổi customer_id
    if (data.user_id && data.user_id.toString() !== existingItem.user_id.toString()) {
      throw new Error('Cannot change the user of a transaction');
    }

    // Cập nhật giao dịch
    const item = await Transaction.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true
    });

    return {
      success: true,
      data: item
    };
  }

  /**
   * Xóa giao dịch
   */
  async remove(id, userRole) {
    // Tìm giao dịch trước khi xóa
    const existingItem = await Transaction.findById(id);
    
    if (!existingItem) {
      throw new Error('Transaction not found');
    }

    // Kiểm tra quyền - chỉ admin mới có thể xóa giao dịch
    if (userRole !== 'admin') {
      throw new Error('Only administrators can delete transactions');
    }

    // Xóa giao dịch
    await Transaction.findByIdAndDelete(id);

    return {
      success: true,
      message: 'Transaction deleted successfully'
    };
  }
}

module.exports = new TransactionService(); 