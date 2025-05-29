const mongoose = require('mongoose');

/**
 * SystemSettings Schema - Lưu trữ cài đặt hệ thống đơn giản
 */
const systemSettingsSchema = new mongoose.Schema({
  // Key duy nhất cho cài đặt
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // Giá trị cài đặt
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Mô tả
  description: {
    type: String,
    required: true,
    trim: true
  },

  // Người cập nhật cuối
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'system_settings'
});

// Static methods
systemSettingsSchema.statics.getSetting = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

systemSettingsSchema.statics.setSetting = async function(key, value, updatedBy = null) {
  return this.findOneAndUpdate(
    { key },
    { value, updated_by: updatedBy },
    { new: true, upsert: true }
  );
};

// Khởi tạo cài đặt mặc định
systemSettingsSchema.statics.initializeDefaults = async function() {
  const defaults = [
    {
      key: 'missed_day_cost',
      value: 50,
      description: 'Chi phí mua một ngày điểm danh bù (xu)'
    },
    {
      key: 'max_buyback_days',
      value: 30,
      description: 'Số ngày tối đa có thể mua bù (tính từ hiện tại)'
    }
  ];

  for (const setting of defaults) {
    try {
      await this.findOneAndUpdate(
        { key: setting.key },
        setting,
        { upsert: true, new: true }
      );
      console.log(`[SystemSettings] Initialized: ${setting.key} = ${setting.value}`);
    } catch (error) {
      console.error(`[SystemSettings] Error initializing ${setting.key}:`, error);
    }
  }
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
