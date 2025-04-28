const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho truyện đã mua
 * Lưu thông tin truyện đã mua của người dùng
 */
const purchasedStorySchema = new Schema({
  // Tham chiếu đến người dùng
  customer_id: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },

  // Tham chiếu đến truyện
  story_id: {
    type: Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
    index: true
  },

  // Số xu đã mua
  coin_bought: {
    type: Number,
    required: true,
    min: 0
  },

  // Trạng thái mua
  status: {
    type: String,
    enum: ['active', 'expired', 'refunded'],
    default: 'active',
    index: true
  },

  // Ngày hết hạn (nếu có)
  expire_date: {
    type: Date,
    default: null
  },

  // Tham chiếu đến giao dịch
  transaction_id: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
purchasedStorySchema.index({ customer_id: 1, story_id: 1 }, { unique: true });
purchasedStorySchema.index({ customer_id: 1, createdAt: -1 });
purchasedStorySchema.index({ expire_date: 1 }, { sparse: true });

// Virtuals
purchasedStorySchema.virtual('story', {
  ref: 'Story',
  localField: 'story_id',
  foreignField: '_id',
  justOne: true
});

purchasedStorySchema.virtual('customer', {
  ref: 'Customer',
  localField: 'customer_id',
  foreignField: '_id',
  justOne: true
});

purchasedStorySchema.virtual('transaction', {
  ref: 'Transaction',
  localField: 'transaction_id',
  foreignField: '_id',
  justOne: true
});

// Phương thức tĩnh để kiểm tra người dùng đã mua truyện chưa
purchasedStorySchema.statics.checkPurchased = async function(customerId, storyId) {
  const purchase = await this.findOne({
    customer_id: customerId,
    story_id: storyId,
    status: 'active'
  });

  // Nếu không tìm thấy, hoặc đã hết hạn
  if (!purchase) {
    return false;
  }

  // Nếu có ngày hết hạn và đã hết hạn
  if (purchase.expire_date && purchase.expire_date < new Date()) {
    purchase.status = 'expired';
    await purchase.save();
    return false;
  }

  return true;
};

// Phương thức tĩnh để lấy danh sách truyện đã mua của người dùng
purchasedStorySchema.statics.findByCustomer = function(customerId, limit = 10, skip = 0) {
  return this.find({
    customer_id: customerId,
    status: 'active'
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('story', 'name slug image');
};

// Phương thức tĩnh để mua truyện
purchasedStorySchema.statics.purchaseStory = async function(customerId, storyId, coinAmount, transactionId = null) {
  return this.findOneAndUpdate(
    { customer_id: customerId, story_id: storyId },
    {
      coin_bought: coinAmount,
      status: 'active',
      transaction_id: transactionId,
      $setOnInsert: { customer_id: customerId, story_id: storyId }
    },
    {
      new: true,
      upsert: true
    }
  );
};

module.exports = mongoose.model('PurchasedStory', purchasedStorySchema);