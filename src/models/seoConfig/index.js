const mongoose = require('mongoose');
const seoConfigSchema = require('./schema');

// Tạo model
const SeoConfig = mongoose.model('SeoConfig', seoConfigSchema);

module.exports = SeoConfig;
