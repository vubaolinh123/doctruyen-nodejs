const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho người dùng
 * Lưu thông tin cơ bản của người dùng
 */
const userSchema = new Schema({
  // Thông tin cá nhân
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  email_verified_at: Date,
  password: {
    type: String,
    required: [function () { return this.accountType !== 'google'; }, 'Password is required']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'other'
  },
  birthday: Date,
  avatar: {
    primaryUrl: {
      type: String,
      required: false,
      default: null,
      trim: true
    },
    variants: [{
      variant: {
        type: String,
        trim: true
      }, // e.g., "200x200", "400x400"
      url: {
        type: String,
        trim: true
      },
      size: {
        type: String,
        trim: true
      }
    }],
    googleDriveId: {
      type: String,
      required: false,
      trim: true
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    metadata: {
      originalFilename: {
        type: String,
        trim: true
      },
      processedVariants: {
        type: Number,
        min: 0
      },
      uploadedFiles: {
        type: Number,
        min: 0
      },
      fileSize: {
        type: String,
        trim: true
      },
      mimeType: {
        type: String,
        trim: true
      },
      dimensions: {
        width: {
          type: Number,
          min: 0
        },
        height: {
          type: Number,
          min: 0
        }
      }
    }
  },
  banner: {
    primaryUrl: {
      type: String,
      required: false,
      default: null,
      trim: true
    },
    variants: [{
      variant: {
        type: String,
        trim: true
      }, // e.g., "200x200", "400x400"
      url: {
        type: String,
        trim: true
      },
      size: {
        type: String,
        trim: true
      }
    }],

    // Enhanced positioning system
    positioning: {
      // Normalized position (0-1) - primary positioning value
      position: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5,
        validate: {
          validator: function(v) {
            return v >= 0 && v <= 1;
          },
          message: 'Banner position must be between 0 and 1'
        }
      },

      // Container context when position was set
      containerHeight: {
        type: Number,
        default: 450,
        min: 200,
        max: 1000
      },
      containerWidth: {
        type: Number,
        min: 200,
        max: 3000
      },

      // Image dimensions for accurate aspect ratio calculation
      imageWidth: {
        type: Number,
        min: 100,
        max: 10000
      },
      imageHeight: {
        type: Number,
        min: 100,
        max: 10000
      },
      aspectRatio: {
        type: Number,
        min: 0.1,
        max: 10
      },

      // Calculated positioning constraints (for verification)
      calculatedImageHeight: {
        type: Number,
        min: 100,
        max: 10000
      },
      maxDragDistance: {
        type: Number,
        min: 0,
        max: 5000
      },
      minOffset: {
        type: Number,
        max: 0
      },
      maxOffset: {
        type: Number,
        default: 0,
        max: 0
      },

      // Positioning context metadata
      positionedAt: {
        type: Date,
        default: Date.now
      },
      deviceType: {
        type: String,
        enum: ['mobile', 'tablet', 'desktop'],
        required: false
      },
      viewportWidth: {
        type: Number,
        min: 200,
        max: 5000,
        required: false
      },
      viewportHeight: {
        type: Number,
        min: 200,
        max: 5000,
        required: false
      }
    },

    // Legacy fields for backward compatibility
    position: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
      validate: {
        validator: function(v) {
          return v >= 0 && v <= 1;
        },
        message: 'Banner position must be between 0 and 1'
      }
    },
    containerHeight: {
      type: Number,
      default: 450,
      min: 200,
      max: 1000,
      validate: {
        validator: function(v) {
          return v >= 200 && v <= 1000;
        },
        message: 'Container height must be between 200 and 1000 pixels'
      }
    },

    lastUpdated: {
      type: Date,
      default: Date.now
    },
    googleDriveId: {
      type: String,
      required: false,
      trim: true
    },
    metadata: {
      fileName: {
        type: String,
        trim: true
      },
      size: {
        type: String,
        trim: true
      },
      mimeType: {
        type: String,
        trim: true
      }
    }
  },

  // Thông tin mạng xã hội và giới thiệu
  social: {
    bio: {
      type: String,
      default: '',
      maxlength: 200,
      trim: true
    },
    facebook: {
      type: String,
      default: '',
      trim: true
    },
    twitter: {
      type: String,
      default: '',
      trim: true
    },
    instagram: {
      type: String,
      default: '',
      trim: true
    },
    youtube: {
      type: String,
      default: '',
      trim: true
    },
    website: {
      type: String,
      default: '',
      trim: true
    }
  },

  // Thông tin tài khoản
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active'
  },
  role: {
    type: String,
    enum: ['user', 'author', 'admin'],
    default: 'user'
  },
  accountType: {
    type: String,
    enum: ['email', 'google'],
    default: 'email'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  last_active: Date,
  email_verified: {
    type: Boolean,
    default: false
  },

  // Thông tin xu và tiền
  coin: {
    type: Number,
    default: 0,
    min: 0
  },
  coin_total: {
    type: Number,
    default: 0,
    min: 0
  },
  coin_spent: {
    type: Number,
    default: 0,
    min: 0
  },
  coin_stats: {
    daily_average: {
      type: Number,
      default: 0
    },
    weekly_average: {
      type: Number,
      default: 0
    },
    monthly_average: {
      type: Number,
      default: 0
    },
    last_updated: {
      type: Date,
      default: Date.now
    }
  },

  // Thông tin điểm danh (đã được tối ưu)
  attendance_summary: {
    total_days: {
      type: Number,
      default: 0,
      min: 0
    },
    current_streak: {
      type: Number,
      default: 0,
      min: 0
    },
    longest_streak: {
      type: Number,
      default: 0,
      min: 0
    },
    last_attendance: {
      type: Date,
      default: null
    }
  },

  // Thông tin bổ sung
  metadata: {
    // Số lượng bình luận đã đăng
    comment_count: {
      type: Number,
      default: 0,
      min: 0
    },
    // Số lượng bình luận đã like
    liked_comments_count: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Thông tin múi giờ của người dùng
  timezone: {
    type: String,
    default: 'Asia/Ho_Chi_Minh',
    description: 'Múi giờ của người dùng (ví dụ: Asia/Ho_Chi_Minh, America/New_York)'
  },

  timezone_offset: {
    type: Number,
    default: 420, // 420 phút = GMT+7
    description: 'Độ lệch múi giờ so với UTC tính bằng phút'
  },



  // Các trường khác
  remember_token: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
userSchema.index({ role: 1, status: 1 });
userSchema.index({ 'attendance_summary.last_attendance': 1 });

module.exports = userSchema;