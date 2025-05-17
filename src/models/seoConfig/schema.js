const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Schema cho cấu hình SEO
 * Lưu thông tin cấu hình SEO cho toàn bộ website
 */
const seoConfigSchema = new Schema({
  // Cấu hình cơ bản
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  titleTemplate: {
    type: String,
    required: true,
    trim: true
  },
  
  defaultTitle: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  canonical: {
    type: String,
    required: true,
    trim: true
  },
  
  // Cấu hình Open Graph
  openGraph: {
    type: {
      type: String,
      default: 'website'
    },
    locale: {
      type: String,
      default: 'vi_VN'
    },
    url: {
      type: String,
      required: true
    },
    siteName: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    images: [{
      url: {
        type: String,
        required: true
      },
      width: {
        type: Number,
        default: 1200
      },
      height: {
        type: Number,
        default: 630
      },
      alt: {
        type: String,
        default: ''
      }
    }]
  },
  
  // Cấu hình Twitter
  twitter: {
    handle: {
      type: String,
      default: ''
    },
    site: {
      type: String,
      default: ''
    },
    cardType: {
      type: String,
      default: 'summary_large_image'
    }
  },
  
  // Các thẻ link bổ sung
  additionalLinkTags: [{
    rel: {
      type: String,
      required: true
    },
    href: {
      type: String,
      required: true
    },
    sizes: {
      type: String,
      default: ''
    }
  }],
  
  // Các thẻ meta bổ sung
  additionalMetaTags: [{
    name: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    }
  }],
  
  // Cấu hình robots
  robotsProps: {
    noindex: {
      type: Boolean,
      default: false
    },
    nofollow: {
      type: Boolean,
      default: false
    },
    nosnippet: {
      type: Boolean,
      default: false
    },
    noarchive: {
      type: Boolean,
      default: false
    },
    maxSnippet: {
      type: Number,
      default: -1
    },
    maxImagePreview: {
      type: String,
      default: 'large'
    },
    maxVideoPreview: {
      type: Number,
      default: -1
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = seoConfigSchema;
