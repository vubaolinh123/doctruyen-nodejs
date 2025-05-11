const express = require('express');
const router = express.Router();
const User = require('../../models/user');
const Transaction = require('../../models/Transaction');
const coinRepair = require('../../utils/coinRepair');

/**
 * @route GET /api/admin/coins/stats
 * @desc Lấy thống kê xu
 * @access Private (Admin)
 */
router.get('/stats', async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    console.log(`[Admin API] Thống kê xu với timeRange = ${timeRange}`);

    // Sử dụng phương thức tĩnh đã tạo trong model Transaction
    const stats = await Transaction.getCoinStats(timeRange);
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
});

/**
 * @route GET /api/admin/coins/chart
 * @desc Lấy dữ liệu biểu đồ xu
 * @access Private (Admin)
 */
router.get('/chart', async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    console.log(`[Admin API] Lấy dữ liệu biểu đồ với timeRange = ${timeRange}`);

    // Sử dụng phương thức tĩnh đã tạo trong model Transaction
    const chartData = await Transaction.getChartData(timeRange);
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
});

/**
 * @route POST /api/admin/coins/manage
 * @desc Quản lý xu của người dùng
 * @access Private (Admin)
 */
router.post('/manage', async (req, res) => {
  try {
    const { userId, action, amount, note } = req.body;
    console.log(`[Admin API] Quản lý xu - userId: ${userId}, action: ${action}, amount: ${amount}`);

    if (!userId || !action || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data'
      });
    }

    // Tìm người dùng
    const user = await User.findById(userId);

    if (!user) {
      console.log(`[Admin API] Không tìm thấy người dùng với ID: ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Thực hiện hành động tương ứng
    let result;
    const adminInfo = {
      admin_id: req.user._id,
      admin_name: req.user.name || req.user.email,
      note: note || ''
    };

    switch (action) {
      case 'give':
        result = await user.addCoins(Number(amount), {
          description: note || 'Thêm xu bởi admin',
          type: 'admin',
          metadata: adminInfo
        });
        break;

      case 'take':
        if (user.coin < Number(amount)) {
          console.log(`[Admin API] Số xu không đủ - hiện tại: ${user.coin}, cần trừ: ${amount}`);
          return res.status(400).json({
            success: false,
            message: 'Số xu không đủ để trừ'
          });
        }

        result = await user.subtractCoins(Number(amount), {
          description: note || 'Trừ xu bởi admin',
          type: 'admin',
          metadata: adminInfo
        });
        break;

      case 'edit':
        result = await user.updateCoins(Number(amount), {
          description: note || 'Cập nhật xu bởi admin',
          type: 'admin',
          metadata: adminInfo
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    console.log(`[Admin API] Quản lý xu thành công - userId: ${userId}, action: ${action}, amount: ${amount}, new balance: ${result}`);

    return res.json({
      success: true,
      message: action === 'give'
        ? `Đã thêm ${Number(amount).toLocaleString()} xu cho người dùng`
        : action === 'take'
          ? `Đã trừ ${Number(amount).toLocaleString()} xu của người dùng`
          : `Đã cập nhật số xu của người dùng thành ${Number(amount).toLocaleString()}`,
      newBalance: result
    });
  } catch (error) {
    console.error('[Admin API] Lỗi khi quản lý xu:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
});

/**
 * @route GET /api/admin/coins/transactions
 * @desc Lấy lịch sử giao dịch xu của người dùng
 * @access Private (Admin)
 */
router.get('/transactions', async (req, res) => {
  try {
    const {
      userId,
      page = 1,
      limit = 10,
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

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Xây dựng query
    const query = { user_id: userId };

    // Thêm điều kiện lọc theo loại giao dịch
    if (type && type !== 'all') {
      query.type = type;
    }

    // Thêm điều kiện lọc theo hướng giao dịch (in/out)
    if (direction && direction !== 'all') {
      query.direction = direction;
    }

    // Thêm điều kiện lọc theo trạng thái
    if (status && status !== 'all') {
      query.status = status;
    }

    // Thêm điều kiện lọc theo tác nhân (admin/system)
    if (agent && agent !== 'all') {
      if (agent === 'admin') {
        query.$or = [
          { type: 'admin' },
          { 'metadata.admin_name': { $exists: true } }
        ];
      } else if (agent === 'system') {
        query.$and = [
          { type: { $ne: 'admin' } },
          { 'metadata.admin_name': { $exists: false } }
        ];
      }
    }

    // Thêm điều kiện lọc theo khoảng thời gian
    if (startDate && endDate) {
      query.transaction_date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.transaction_date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.transaction_date = { $lte: new Date(endDate) };
    }

    // Thêm điều kiện tìm kiếm theo ghi chú
    if (search) {
      // Nếu đã có $or từ bộ lọc agent, chuyển thành $and
      if (query.$or) {
        const agentCondition = query.$or;
        delete query.$or;
        
        query.$and = [
          { $or: agentCondition }, 
          { $or: [
              { description: { $regex: search, $options: 'i' } },
              { 'metadata.note': { $regex: search, $options: 'i' } },
              { 'metadata.reason': { $regex: search, $options: 'i' } }
            ]
          }
        ];
      } else {
        query.$or = [
          { description: { $regex: search, $options: 'i' } },
          { 'metadata.note': { $regex: search, $options: 'i' } },
          { 'metadata.reason': { $regex: search, $options: 'i' } }
        ];
      }
    }

    console.log(`[Admin API] Query lịch sử giao dịch:`, JSON.stringify(query));

    // Tìm tổng số giao dịch
    const totalItems = await Transaction.countDocuments(query);

    // Lấy danh sách giao dịch
    const transactions = await Transaction.find(query)
      .sort({ transaction_date: -1 })
      .skip(skip)
      .limit(limitNumber);

    console.log(`[Admin API] Lấy lịch sử giao dịch thành công - tổng số: ${totalItems}, trang hiện tại: ${pageNumber}/${Math.ceil(totalItems / limitNumber)}`);

    return res.json({
      success: true,
      transactions,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNumber),
        totalRecords: totalItems
      }
    });
  } catch (error) {
    console.error('[Admin API] Lỗi khi lấy lịch sử giao dịch:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
});

/**
 * @route POST /api/admin/coins/check-consistency
 * @desc Kiểm tra tính nhất quán của dữ liệu xu
 * @access Private (Admin)
 */
router.post('/check-consistency', async (req, res) => {
  try {
    console.log("[Admin API] Kiểm tra tính nhất quán của dữ liệu xu");
    
    const results = await coinRepair.checkCoinDataConsistency();
    
    console.log("[Admin API] Kết quả kiểm tra tính nhất quán:", results);
    
    return res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('[Admin API] Lỗi khi kiểm tra tính nhất quán của dữ liệu xu:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
});

/**
 * @route POST /api/admin/coins/repair
 * @desc Sửa chữa dữ liệu xu không nhất quán
 * @access Private (Admin)
 */
router.post('/repair', async (req, res) => {
  try {
    console.log("[Admin API] Sửa chữa dữ liệu xu không nhất quán");
    
    const results = await coinRepair.repairTransactionDirection();
    
    console.log("[Admin API] Kết quả sửa chữa dữ liệu xu:", results);
    
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
});

module.exports = router;
