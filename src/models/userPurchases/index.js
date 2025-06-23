const mongoose = require('mongoose');
const schema = require('./schema');
const statics = require('./statics');

// Áp dụng các phần của model
statics(schema);

// Tạo model
const UserPurchases = mongoose.model('UserPurchases', schema);

module.exports = UserPurchases;
