const mongoose = require('mongoose');
const schema = require('./schema');
const virtuals = require('./virtuals');
const statics = require('./statics');

// Áp dụng các phần của model
virtuals(schema);
statics(schema);

// Tạo và export model
module.exports = mongoose.model('PurchasedStory', schema); 