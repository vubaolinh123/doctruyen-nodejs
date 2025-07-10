const express = require('express');
const router = express.Router();
const controller = require('../controllers/mission');
const auth = require('../middleware/auth');

// ==========================================================
// CÁC ROUTE CÔNG KHAI (KHÔNG CẦN XÁC THỰC)
// ==========================================================

// Lấy danh sách nhiệm vụ hàng ngày
router.get('/daily', controller.getDailyMissions);

// Lấy danh sách nhiệm vụ hàng tuần
router.get('/weekly', controller.getWeeklyMissions);

// ==========================================================
// CÁC ROUTE ADMIN (CẦN XÁC THỰC)
// ==========================================================

// Admin - Lấy danh sách nhiệm vụ có phân trang và lọc
router.get('/admin', auth, controller.getAll);

// Admin - Lấy thống kê về nhiệm vụ (PHẢI ĐẶT TRƯỚC ROUTE ĐỘNG /admin/:id)
router.get('/admin/stats', auth, controller.getMissionStats);

// Admin - Lấy chi tiết một nhiệm vụ
router.get('/admin/:id', auth, controller.getById);

// Admin - Tạo nhiệm vụ mới
router.post('/admin', auth, controller.create);

// Admin - Cập nhật thông tin nhiệm vụ
router.put('/admin/:id', auth, controller.update);

// Admin - Xóa nhiệm vụ
router.delete('/admin/:id', auth, controller.remove);

// Admin - Bật/tắt trạng thái nhiệm vụ
router.put('/admin/:id/toggle-status', auth, controller.toggleStatus);

// ==========================================================
// CÁC ROUTE USER (CẦN XÁC THỰC)
// ==========================================================

// Lấy tiến trình nhiệm vụ của người dùng
router.get('/progress/:userId', auth, controller.getUserMissionProgress);

// Nhận thưởng nhiệm vụ
router.post('/claim-reward/:missionId', auth, controller.claimMissionReward);

module.exports = router;
