const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    customers_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    transaction_id: String,
    amount: Number,
    description: String,
    transaction_date: Date,
    up_point: Number,
    type: String
  }, { timestamps: true });
  
  module.exports = mongoose.model('Transaction', transactionSchema);