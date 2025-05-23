const mongoose = require('mongoose');
const cacheConfigSchema = require('./schema');

// Tạo model với tên collection cụ thể
const CacheConfig = mongoose.model('CacheConfig', cacheConfigSchema, 'cacheconfigs');

// Log thông tin về model và collection
console.log('[Model] CacheConfig model created with collection:',
  CacheConfig.collection ? CacheConfig.collection.name : 'unknown');

module.exports = CacheConfig;
