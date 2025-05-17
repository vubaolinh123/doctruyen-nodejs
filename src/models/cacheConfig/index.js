const mongoose = require('mongoose');
const cacheConfigSchema = require('./schema');

// Tạo model
const CacheConfig = mongoose.model('CacheConfig', cacheConfigSchema);

module.exports = CacheConfig;
