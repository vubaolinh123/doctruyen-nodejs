const express = require('express');
const router = express.Router();
const permissionTemplateController = require('../../controllers/admin/permissionTemplateController');
const permissionController = require('../../controllers/user/permissionController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// Middleware: Yêu cầu đăng nhập và quyền admin
router.use(authenticateToken);
router.use(requireAdmin);

// Routes cho metadata
router.get('/categories', permissionTemplateController.getCategories);
router.get('/tags', permissionTemplateController.getTags);
router.get('/stats', permissionTemplateController.getStats);
router.get('/dropdown', permissionController.getPermissionTemplatesForDropdown);

// Bulk operations
router.post('/bulk', permissionTemplateController.bulkOperations);

// Routes cho CRUD operations
router.get('/', permissionTemplateController.getTemplates);
router.post('/', permissionTemplateController.createTemplate);
router.get('/:id', permissionTemplateController.getTemplate);
router.put('/:id', permissionTemplateController.updateTemplate);
router.delete('/:id', permissionTemplateController.deleteTemplate);

// Routes cho status management
router.put('/:id/toggle-status', permissionTemplateController.toggleStatus);

// Routes cho usage tracking
router.get('/:id/users', permissionTemplateController.getTemplateUsers);

module.exports = router;
