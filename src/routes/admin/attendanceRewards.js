const express = require('express');
const router = express.Router();
const AttendanceReward = require('../../models/attendanceReward');
const PermissionTemplate = require('../../models/permissionTemplate');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { body, param, query } = require('express-validator');

/**
 * @route GET /api/admin/attendance-rewards
 * @desc Lấy danh sách mốc phần thưởng điểm danh
 * @access Admin
 */
router.get('/', 
  authenticateToken,
  requireAdmin,
  [
    query('type').optional().isIn(['consecutive', 'total']).withMessage('Type phải là consecutive hoặc total'),
    query('is_active').optional().isBoolean().withMessage('is_active phải là boolean'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit phải từ 1-100')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { type, is_active, page = 1, limit = 20 } = req.query;
      
      // Build query
      const query = {};
      if (type) query.type = type;
      if (is_active !== undefined) query.is_active = is_active === 'true';

      // Get total count
      const total = await AttendanceReward.countDocuments(query);

      // Get rewards with pagination
      const rewards = await AttendanceReward.find(query)
        .populate('permission_id', 'name description')
        .sort({ type: 1, required_days: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      res.json({
        success: true,
        data: {
          rewards,
          pagination: {
            current: parseInt(page),
            total: Math.ceil(total / limit),
            count: rewards.length,
            totalRecords: total
          }
        }
      });
    } catch (error) {
      console.error('Error fetching attendance rewards:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách mốc phần thưởng',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/admin/attendance-rewards/:id
 * @desc Lấy chi tiết mốc phần thưởng
 * @access Admin
 */
router.get('/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isMongoId().withMessage('ID không hợp lệ')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const reward = await AttendanceReward.getRewardById(req.params.id);
      
      if (!reward) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy mốc phần thưởng'
        });
      }

      res.json({
        success: true,
        data: reward
      });
    } catch (error) {
      console.error('Error fetching attendance reward:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin mốc phần thưởng',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/admin/attendance-rewards
 * @desc Tạo mốc phần thưởng mới
 * @access Admin
 */
router.post('/',
  authenticateToken,
  requireAdmin,
  [
    body('type').isIn(['consecutive', 'total']).withMessage('Type phải là consecutive hoặc total'),
    body('required_days').isInt({ min: 1 }).withMessage('Số ngày yêu cầu phải là số nguyên dương'),
    body('reward_type').isIn(['coin', 'permission']).withMessage('Reward type phải là coin hoặc permission'),
    body('reward_value').optional().isInt({ min: 0 }).withMessage('Reward value phải là số nguyên không âm'),
    body('permission_id').optional().isMongoId().withMessage('Permission ID không hợp lệ'),
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title phải từ 1-200 ký tự'),
    body('description').trim().isLength({ min: 1, max: 500 }).withMessage('Description phải từ 1-500 ký tự'),
    body('is_active').optional().isBoolean().withMessage('is_active phải là boolean')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const rewardData = req.body;

      // Validate business logic
      if (rewardData.reward_type === 'coin' && (!rewardData.reward_value || rewardData.reward_value <= 0)) {
        return res.status(400).json({
          success: false,
          message: 'Giá trị xu phải lớn hơn 0 khi loại phần thưởng là coin'
        });
      }

      if (rewardData.reward_type === 'permission' && !rewardData.permission_id) {
        return res.status(400).json({
          success: false,
          message: 'Permission ID là bắt buộc khi loại phần thưởng là permission'
        });
      }

      // Kiểm tra permission tồn tại nếu là permission reward
      if (rewardData.reward_type === 'permission') {
        const permission = await PermissionTemplate.findById(rewardData.permission_id);
        if (!permission) {
          return res.status(400).json({
            success: false,
            message: 'Permission không tồn tại'
          });
        }
      }

      const reward = await AttendanceReward.createReward(rewardData);

      res.status(201).json({
        success: true,
        message: 'Tạo mốc phần thưởng thành công',
        data: reward
      });
    } catch (error) {
      console.error('Error creating attendance reward:', error);
      
      if (error.message.includes('đã tồn tại')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo mốc phần thưởng',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/admin/attendance-rewards/:id
 * @desc Cập nhật mốc phần thưởng
 * @access Admin
 */
router.put('/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isMongoId().withMessage('ID không hợp lệ'),
    body('type').optional().isIn(['consecutive', 'total']).withMessage('Type phải là consecutive hoặc total'),
    body('required_days').optional().isInt({ min: 1 }).withMessage('Số ngày yêu cầu phải là số nguyên dương'),
    body('reward_type').optional().isIn(['coin', 'permission']).withMessage('Reward type phải là coin hoặc permission'),
    body('reward_value').optional().isInt({ min: 0 }).withMessage('Reward value phải là số nguyên không âm'),
    body('permission_id').optional().isMongoId().withMessage('Permission ID không hợp lệ'),
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title phải từ 1-200 ký tự'),
    body('description').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Description phải từ 1-500 ký tự'),
    body('is_active').optional().isBoolean().withMessage('is_active phải là boolean')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const updateData = req.body;

      // Validate business logic
      if (updateData.reward_type === 'coin' && updateData.reward_value !== undefined && updateData.reward_value <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Giá trị xu phải lớn hơn 0 khi loại phần thưởng là coin'
        });
      }

      if (updateData.reward_type === 'permission' && !updateData.permission_id) {
        return res.status(400).json({
          success: false,
          message: 'Permission ID là bắt buộc khi loại phần thưởng là permission'
        });
      }

      // Kiểm tra permission tồn tại nếu update permission_id
      if (updateData.permission_id) {
        const permission = await PermissionTemplate.findById(updateData.permission_id);
        if (!permission) {
          return res.status(400).json({
            success: false,
            message: 'Permission không tồn tại'
          });
        }
      }

      const reward = await AttendanceReward.updateReward(req.params.id, updateData);

      if (!reward) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy mốc phần thưởng'
        });
      }

      res.json({
        success: true,
        message: 'Cập nhật mốc phần thưởng thành công',
        data: reward
      });
    } catch (error) {
      console.error('Error updating attendance reward:', error);
      
      if (error.message.includes('đã tồn tại') || error.message.includes('Không tìm thấy')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật mốc phần thưởng',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/admin/attendance-rewards/:id
 * @desc Xóa mốc phần thưởng (soft delete)
 * @access Admin
 */
router.delete('/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isMongoId().withMessage('ID không hợp lệ')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const reward = await AttendanceReward.deleteReward(req.params.id);

      if (!reward) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy mốc phần thưởng'
        });
      }

      res.json({
        success: true,
        message: 'Xóa mốc phần thưởng thành công',
        data: reward
      });
    } catch (error) {
      console.error('Error deleting attendance reward:', error);
      
      if (error.message.includes('Không tìm thấy')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa mốc phần thưởng',
        error: error.message
      });
    }
  }
);

module.exports = router;
