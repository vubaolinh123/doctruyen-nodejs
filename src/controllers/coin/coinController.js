const coinService = require('../../services/coin/coinService');

/**
 * Lấy thống kê xu
 * @route GET /api/admin/coins/stats
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @access Private (Admin)
 */
exports.getStats = async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    console.log(`[Admin API] Thống kê xu với timeRange = ${timeRange}`);

    const stats = await coinService.getStats(timeRange);
    console.log(`[Admin API] Thống kê xu thành công:`, stats);

    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Admin API] Lỗi khi lấy thống kê xu:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
};

/**
 * Lấy dữ liệu biểu đồ xu
 * @route GET /api/admin/coins/chart
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @access Private (Admin)
 */
exports.getChart = async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    console.log(`[Admin API] Lấy dữ liệu biểu đồ với timeRange = ${timeRange}`);

    const chartData = await coinService.getChartData(timeRange);
    console.log(`[Admin API] Lấy dữ liệu biểu đồ thành công, số lượng dữ liệu:
      - categories: ${chartData.categories?.length || 0}
      - series[0].data: ${chartData.series?.[0]?.data?.length || 0}`);

    return res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    console.error('[Admin API] Lỗi khi lấy dữ liệu biểu đồ:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
};

/**
 * Quản lý xu của người dùng
 * @route POST /api/admin/coins/manage
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @access Private (Admin)
 */
exports.manageCoins = async (req, res) => {
  try {
    const { userId, action, amount, note } = req.body;
    console.log(`[Admin API] Quản lý xu - userId: ${userId}, action: ${action}, amount: ${amount}`);

    if (!userId || !action || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data'
      });
    }

    const adminInfo = {
      admin_id: req.user._id,
      admin_name: req.user.name || req.user.email,
      note: note || ''
    };

    const result = await coinService.manageCoins(userId, action, amount, note, adminInfo);

    console.log(`[Admin API] Quản lý xu thành công - userId: ${userId}, action: ${action}, amount: ${amount}, new balance: ${result.newBalance}`);

    return res.json({
      success: true,
      message: action === 'give'
        ? `Đã thêm ${Number(amount).toLocaleString()} xu cho người dùng`
        : action === 'take'
          ? `Đã trừ ${Number(amount).toLocaleString()} xu của người dùng`
          : `Đã cập nhật số xu của người dùng thành ${Number(amount).toLocaleString()}`,
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('[Admin API] Lỗi khi quản lý xu:', error);

    // Xử lý lỗi cụ thể từ service
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    if (error.message === 'Số xu không đủ để trừ') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Invalid action') {
      return res.status(400).json({
        success: false,
        message: 'Hành động không hợp lệ'
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
};

/**
 * Lấy lịch sử giao dịch xu của người dùng
 * @route GET /api/admin/coins/transactions
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @access Private (Admin)
 */
exports.getTransactions = async (req, res) => {
  try {
    const {
      userId,
      page,
      limit,
      type,
      direction,
      status,
      agent,
      startDate,
      endDate,
      search
    } = req.query;

    console.log(`[Admin API] Lấy lịch sử giao dịch - userId: ${userId}, page: ${page}, limit: ${limit}`);
    console.log(`[Admin API] Các bộ lọc: type=${type}, direction=${direction}, status=${status}, agent=${agent}, search=${search}`);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const result = await coinService.getTransactions({
      userId,
      page,
      limit,
      type,
      direction,
      status,
      agent,
      startDate,
      endDate,
      search
    });

    console.log(`[Admin API] Lấy lịch sử giao dịch thành công - tổng số: ${result.pagination.total}, hiển thị: ${result.transactions.length}`);

    return res.json({
      success: true,
      transactions: result.transactions,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[Admin API] Lỗi khi lấy lịch sử giao dịch:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
};

/**
 * Kiểm tra tính nhất quán của dữ liệu xu
 * @route POST /api/admin/coins/check-consistency
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @access Private (Admin)
 */
exports.checkConsistency = async (req, res) => {
  try {
    console.log(`[Admin API] Kiểm tra tính nhất quán của dữ liệu xu`);

    // Sử dụng hàm kiểm tra tính nhất quán từ coinRepair
    const coinRepair = require('../../utils/coinRepair');
    const results = await coinRepair.checkCoinDataConsistency();

    console.log(`[Admin API] Kết quả kiểm tra tính nhất quán:`, results);

    return res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('[Admin API] Lỗi khi kiểm tra tính nhất quán:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
};

/**
 * Sửa chữa dữ liệu xu không nhất quán
 * @route POST /api/admin/coins/repair
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @access Private (Admin)
 */
exports.repairData = async (req, res) => {
  try {
    console.log(`[Admin API] Sửa chữa dữ liệu xu không nhất quán`);

    // Sử dụng hàm sửa chữa từ coinRepair
    const coinRepair = require('../../utils/coinRepair');
    const results = await coinRepair.repairTransactionDirection();

    console.log(`[Admin API] Kết quả sửa chữa dữ liệu xu:`, results);

    return res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('[Admin API] Lỗi khi sửa chữa dữ liệu xu:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
};

/**
 * Sửa chữa số dư xu của người dùng
 * @route POST /api/admin/coins/repair-coins
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @access Private (Admin)
 */
exports.repairCoins = async (req, res) => {
  try {
    console.log(`[Admin API] Bắt đầu sửa chữa số dư xu của người dùng`);

    const result = await coinService.repairCoins(req.user._id);

    console.log(`[Admin API] Kết quả sửa chữa xu: ${result.fixed} người dùng được sửa, ${result.total} người dùng được kiểm tra`);

    return res.json({
      success: true,
      message: `Đã sửa chữa số dư xu cho ${result.fixed}/${result.total} người dùng`,
      data: result
    });
  } catch (error) {
    console.error('[Admin API] Lỗi khi sửa chữa số dư xu:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
};