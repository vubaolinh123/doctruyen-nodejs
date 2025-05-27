const mongoose = require('mongoose');
const userPermissionSchema = require('./schema');
const vietnamTimezonePlugin = require('../../plugins/vietnamTimezone');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(userPermissionSchema);

// Thiết lập methods
setupMethods(userPermissionSchema);

// Thiết lập statics
setupStatics(userPermissionSchema);

// Thiết lập hooks
setupHooks(userPermissionSchema);

// Áp dụng plugin timezone Việt Nam
userPermissionSchema.plugin(vietnamTimezonePlugin);

// Tạo model
const UserPermission = mongoose.model('UserPermission', userPermissionSchema);

module.exports = UserPermission;
