const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho cấu hình cache
 * Lưu thông tin cấu hình cache cho toàn bộ website
 */
const cacheConfigSchema = new Schema({
  // Cấu hình cache API
  api: {
    // Thời gian cache cho API (giây)
    ttl: {
      type: Number,
      default: 60,
      min: 0,
      max: 86400 // 1 ngày
    },
    
    // Có bật cache cho API không
    enabled: {
      type: Boolean,
      default: true
    },
    
    // Cấu hình chi tiết cho từng loại API
    stories: {
      ttl: {
        type: Number,
        default: 60,
        min: 0,
        max: 86400
      },
      enabled: {
        type: Boolean,
        default: true
      }
    },
    
    chapters: {
      ttl: {
        type: Number,
        default: 60,
        min: 0,
        max: 86400
      },
      enabled: {
        type: Boolean,
        default: true
      }
    },
    
    categories: {
      ttl: {
        type: Number,
        default: 300, // 5 phút
        min: 0,
        max: 86400
      },
      enabled: {
        type: Boolean,
        default: true
      }
    },
    
    search: {
      ttl: {
        type: Number,
        default: 30,
        min: 0,
        max: 86400
      },
      enabled: {
        type: Boolean,
        default: true
      }
    },
    
    seo: {
      ttl: {
        type: Number,
        default: 3600, // 1 giờ
        min: 0,
        max: 86400
      },
      enabled: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Cấu hình cache trang
  pages: {
    // Thời gian cache cho trang (giây)
    ttl: {
      type: Number,
      default: 60,
      min: 0,
      max: 86400
    },
    
    // Có bật cache cho trang không
    enabled: {
      type: Boolean,
      default: true
    },
    
    // Cấu hình chi tiết cho từng loại trang
    home: {
      ttl: {
        type: Number,
        default: 60,
        min: 0,
        max: 86400
      },
      enabled: {
        type: Boolean,
        default: true
      }
    },
    
    story: {
      ttl: {
        type: Number,
        default: 60,
        min: 0,
        max: 86400
      },
      enabled: {
        type: Boolean,
        default: true
      }
    },
    
    chapter: {
      ttl: {
        type: Number,
        default: 60,
        min: 0,
        max: 86400
      },
      enabled: {
        type: Boolean,
        default: true
      }
    },
    
    category: {
      ttl: {
        type: Number,
        default: 60,
        min: 0,
        max: 86400
      },
      enabled: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Cấu hình cache hình ảnh
  images: {
    // Thời gian cache cho hình ảnh (giây)
    ttl: {
      type: Number,
      default: 86400, // 1 ngày
      min: 0,
      max: 2592000 // 30 ngày
    },
    
    // Có bật cache cho hình ảnh không
    enabled: {
      type: Boolean,
      default: true
    }
  },
  
  // Thời gian cập nhật cuối cùng
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = cacheConfigSchema;
