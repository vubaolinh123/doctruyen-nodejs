const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Advanced Comment Schema với Materialized Path approach
 * Tối ưu cho performance và scalability
 * Hỗ trợ nested comments, moderation, và analytics
 */
const commentSchema = new Schema({
  // === BASIC INFORMATION ===
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Target content (story hoặc chapter)
  target: {
    story_id: {
      type: Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
      index: true
    },
    chapter_id: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter'
    },
    type: {
      type: String,
      enum: ['story', 'chapter'],
      required: true,
      index: true
    }
  },

  // === CONTENT ===
  content: {
    original: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    sanitized: {
      type: String,
      trim: true
    },
    mentions: [{
      user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      username: String,
      position: Number
    }],
    // Quote support for Level 3 -> Level 2 conversion
    quote: {
      // ID of the comment being quoted
      quoted_comment_id: {
        type: Schema.Types.ObjectId,
        ref: 'Comment'
      },
      // Username of the quoted comment author
      quoted_username: {
        type: String,
        trim: true
      },
      // Truncated text being quoted (max 50 chars)
      quoted_text: {
        type: String,
        trim: true,
        maxlength: 53 // 50 chars + "..."
      },
      // Full original text for reference
      quoted_full_text: {
        type: String,
        trim: true
      },
      // Indicates this comment was created from Level 3 -> Level 2 conversion
      is_level_conversion: {
        type: Boolean,
        default: false
      }
    }
  },

  // === HIERARCHICAL STRUCTURE (Materialized Path) ===
  hierarchy: {
    // Materialized path: "/1/5/12/" means root->1->5->12
    path: {
      type: String,
      index: true,
      default: ''
    },
    // Direct parent ID
    parent_id: {
      type: Schema.Types.ObjectId,
      ref: 'Comment'
    },
    // Depth level (0 = root comment, 1 = first reply, etc.)
    level: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 3, // Giới hạn tối đa 3 levels
      index: true
    },
    // Root comment ID (for easy querying)
    root_id: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      index: true
    }
  },

  // === ENGAGEMENT METRICS ===
  engagement: {
    likes: {
      count: {
        type: Number,
        default: 0,
        min: 0
      },
      users: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
      }]
    },
    dislikes: {
      count: {
        type: Number,
        default: 0,
        min: 0
      },
      users: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
      }]
    },
    replies: {
      count: {
        type: Number,
        default: 0,
        min: 0
      },
      last_reply_at: Date
    },
    // Engagement score for ranking
    score: {
      type: Number,
      default: 0,
      index: true
    }
  },

  // === MODERATION ===
  moderation: {
    status: {
      type: String,
      enum: ['active', 'pending', 'hidden', 'deleted', 'spam'],
      default: 'active',
      index: true
    },
    flags: {
      count: {
        type: Number,
        default: 0,
        min: 0
      },
      reasons: [{
        type: String,
        enum: ['spam', 'inappropriate', 'harassment', 'off-topic', 'violence', 'hate-speech', 'misinformation', 'copyright', 'other']
      }],
      flagged_by: [{
        user_id: {
          type: Schema.Types.ObjectId,
          ref: 'User'
        },
        reason: {
          type: String,
          enum: ['spam', 'inappropriate', 'harassment', 'off-topic', 'violence', 'hate-speech', 'misinformation', 'copyright', 'other']
        },
        custom_reason: String, // For 'other' category
        severity: {
          type: String,
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'medium'
        },
        flagged_at: {
          type: Date,
          default: Date.now
        },
        reporter_ip: String, // Hashed IP for tracking
        additional_context: String // Extra details from reporter
      }],
      // Report resolution tracking
      resolution: {
        status: {
          type: String,
          enum: ['pending', 'resolved', 'dismissed', 'escalated'],
          default: 'pending'
        },
        resolved_by: {
          type: Schema.Types.ObjectId,
          ref: 'User'
        },
        resolved_at: Date,
        resolution_reason: String,
        admin_notes: String,
        action_taken: {
          type: String,
          enum: ['none', 'warning', 'content-hidden', 'content-deleted', 'user-suspended', 'user-banned']
        }
      }
    },
    auto_moderation: {
      spam_score: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
      },
      toxicity_score: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
      },
      checked_at: Date
    },
    moderated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    moderated_at: Date,
    moderation_reason: String
  },

  // === METADATA ===
  metadata: {
    // IP address for spam detection (hashed)
    ip_hash: String,
    // User agent hash
    user_agent_hash: String,
    // Edit history
    edit_history: [{
      content: String,
      edited_at: {
        type: Date,
        default: Date.now
      },
      edit_reason: String
    }],
    // Position in chapter (for chapter comments)
    chapter_position: {
      type: Number,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive data from JSON output with safe checks
      try {
        // Safely remove metadata sensitive fields
        if (ret.metadata && typeof ret.metadata === 'object') {
          delete ret.metadata.ip_hash;
          delete ret.metadata.user_agent_hash;
        }

        // Safely remove moderation auto_moderation
        if (ret.moderation && typeof ret.moderation === 'object') {
          delete ret.moderation.auto_moderation;
        }

        return ret;
      } catch (error) {
        console.error('Error in comment schema transform:', error);
        // Return the original ret object if transform fails
        return ret;
      }
    }
  },
  toObject: { virtuals: true }
});

// === INDEXES FOR PERFORMANCE ===
// Compound indexes for common query patterns
commentSchema.index({ 'target.story_id': 1, 'moderation.status': 1, createdAt: -1 });
commentSchema.index({ 'target.chapter_id': 1, 'moderation.status': 1, createdAt: -1 });
commentSchema.index({ 'hierarchy.path': 1, 'moderation.status': 1, createdAt: -1 });
commentSchema.index({ 'hierarchy.root_id': 1, 'hierarchy.level': 1, createdAt: 1 });
commentSchema.index({ user_id: 1, createdAt: -1 });
commentSchema.index({ 'engagement.score': -1, createdAt: -1 });

// Text index for search
commentSchema.index({ 'content.sanitized': 'text' });

// Reported comments indexes
commentSchema.index({ 'moderation.flags.count': 1, 'moderation.flags.resolution.status': 1, createdAt: -1 });
commentSchema.index({ 'moderation.flags.resolution.status': 1, 'moderation.flags.flagged_by.severity': 1, createdAt: -1 });
commentSchema.index({ 'moderation.flags.flagged_by.reason': 1, createdAt: -1 });

// Sparse indexes
commentSchema.index({ 'hierarchy.parent_id': 1 }, { sparse: true });
commentSchema.index({ 'target.chapter_id': 1 }, { sparse: true });

// === SCHEMA METHODS ===

/**
 * Pre-save middleware to ensure required nested objects exist
 */
commentSchema.pre('save', function(next) {
  // Ensure metadata object exists
  if (!this.metadata) {
    this.metadata = {};
  }

  // Ensure moderation object exists with default values
  if (!this.moderation) {
    this.moderation = {
      status: 'active',
      flags: {
        count: 0,
        reasons: [],
        flagged_by: []
      }
    };
  }

  // Ensure moderation.flags exists
  if (!this.moderation.flags) {
    this.moderation.flags = {
      count: 0,
      reasons: [],
      flagged_by: []
    };
  }

  // Ensure engagement object exists
  if (!this.engagement) {
    this.engagement = {
      likes: { count: 0, users: [] },
      dislikes: { count: 0, users: [] },
      replies: { count: 0 },
      score: 0
    };
  }

  next();
});

/**
 * Static method to safely find comments with proper structure validation
 */
commentSchema.statics.findSafe = function(query = {}, options = {}) {
  // Add validation to ensure documents have required structure
  const safeQuery = {
    ...query,
    'target': { $exists: true, $ne: null },
    'moderation': { $exists: true, $ne: null }
  };

  return this.find(safeQuery, null, options);
};

module.exports = commentSchema;
