const mongoose = require('mongoose');
const missionSchema = require('./schema');

// Import các module
const setupVirtuals = require('./virtuals');
const setupMethods = require('./methods');
const setupStatics = require('./statics');
const setupHooks = require('./hooks');

// Thiết lập virtuals
setupVirtuals(missionSchema);

// Thiết lập methods
setupMethods(missionSchema);

// Thiết lập statics
setupStatics(missionSchema);

// Thiết lập hooks
setupHooks(missionSchema);

// Tạo model
const Mission = mongoose.model('Mission', missionSchema);

module.exports = Mission;
