const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  email_verified_at: Date,
  password: {
    type: String,
    required: [function () { return this.accountType !== 'google'; }, 'Password is required']
  },
  gender: { type: String, default: '' },
  birthday: Date,
  avatar: { type: String, default: '' },
  status: { type: Number, default: 1 },
  diem_danh: { type: Number, default: 0 },
  tu_vi: { type: String, default: '' },
  coin: { type: Number, default: 0 },
  coin_total: { type: Number, default: 0 },
  role: { type: Number, default: 0 },
  accountType: { type: String, default: 'email' },
  isActive: { type: Boolean, default: true },
  tu_bao_cac: { type: String, default: '' },
  last_active: Date,
  check_in_date: Date,
  remember_token: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);