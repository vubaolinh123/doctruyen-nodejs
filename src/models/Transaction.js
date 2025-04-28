const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho giao dịch
 * Lưu thông tin các giao dịch xu/tiền của người dùng
 */
const transactionSchema = new Schema({
  // ID của người dùng
  customer_id: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },

  // Mã giao dịch
  transaction_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Số tiền/xu giao dịch
  amount: {
    type: Number,
    required: true
  },

  // Mô tả giao dịch
  description: {
    type: String,
    default: ''
  },

  // Ngày giao dịch
  transaction_date: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Số xu tăng/giảm
  coin_change: {
    type: Number,
    default: 0
  },

  // Loại giao dịch
  type: {
    type: String,
    enum: ['attendance', 'purchase', 'reward', 'admin', 'refund', 'other'],
    default: 'other',
    index: true
  },

  // Trạng thái giao dịch
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed',
    index: true
  },

  // Tham chiếu đến đối tượng liên quan (nếu có)
  reference_type: {
    type: String,
    enum: ['story', 'chapter', 'attendance', 'other', ''],
    default: ''
  },

  reference_id: {
    type: Schema.Types.ObjectId,
    default: null
  },

  // Metadata bổ sung
  metadata: {
    type: Object,
    default: {}
  },

  // Trường tương thích ngược - sẽ loại bỏ trong tương lai
  customers_id: {
    type: Schema.Types.ObjectId,
    ref: 'Customer'
  },
  up_point: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
transactionSchema.index({ transaction_date: -1 });
transactionSchema.index({ customer_id: 1, transaction_date: -1 });
transactionSchema.index({ type: 1, transaction_date: -1 });
transactionSchema.index({ status: 1 });

// Virtuals
transactionSchema.virtual('customer', {
  ref: 'Customer',
  localField: 'customer_id',
  foreignField: '_id',
  justOne: true
});

// Middleware pre-save để đảm bảo tương thích ngược
transactionSchema.pre('save', function(next) {
  // Đảm bảo customers_id luôn đồng bộ với customer_id
  if (this.customer_id && !this.customers_id) {
    this.customers_id = this.customer_id;
  } else if (this.customers_id && !this.customer_id) {
    this.customer_id = this.customers_id;
  }

  // Đảm bảo up_point luôn đồng bộ với coin_change
  if (this.coin_change !== undefined && this.up_point === undefined) {
    this.up_point = this.coin_change;
  } else if (this.up_point !== undefined && this.coin_change === undefined) {
    this.coin_change = this.up_point;
  }

  next();
});

// Phương thức tĩnh để tạo giao dịch mới
transactionSchema.statics.createTransaction = async function(data) {
  const {
    customer_id,
    amount,
    description,
    type,
    coin_change,
    reference_type,
    reference_id,
    metadata
  } = data;

  // Tạo mã giao dịch duy nhất
  const transaction_id = `${type.toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  return this.create({
    customer_id,
    transaction_id,
    amount,
    description,
    transaction_date: new Date(),
    coin_change,
    type,
    status: 'completed',
    reference_type: reference_type || '',
    reference_id: reference_id || null,
    metadata: metadata || {},
    // Trường tương thích ngược
    customers_id: customer_id,
    up_point: coin_change
  });
};

module.exports = mongoose.model('Transaction', transactionSchema);