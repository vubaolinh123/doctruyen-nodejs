const mongoose = require('mongoose');
const schema = require('./schema');
const virtuals = require('./virtuals');
const statics = require('./statics');
const hooks = require('./hooks');

// Áp dụng các phần của model
virtuals(schema);
statics(schema);
hooks(schema);

// Tạo và export model
module.exports = mongoose.models.Transaction || mongoose.model('Transaction', schema);