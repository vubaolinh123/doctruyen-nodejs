const mongoose = require('mongoose');
const permissionTemplateSchema = require('./schema');
const vietnamTimezonePlugin = require('../../plugins/vietnamTimezone');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(permissionTemplateSchema);

// Thiết lập methods
setupMethods(permissionTemplateSchema);

// Thiết lập statics
setupStatics(permissionTemplateSchema);

// Thiết lập hooks
setupHooks(permissionTemplateSchema);

// Áp dụng plugin timezone Việt Nam
permissionTemplateSchema.plugin(vietnamTimezonePlugin);

// Tạo model
const PermissionTemplate = mongoose.model('PermissionTemplate', permissionTemplateSchema);

module.exports = PermissionTemplate;
