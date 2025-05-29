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
    }]
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
        enum: ['spam', 'inappropriate', 'harassment', 'off-topic', 'other']
      }],
      flagged_by: [{
        user_id: {
          type: Schema.Types.ObjectId,
          ref: 'User'
        },
        reason: String,
        flagged_at: {
          type: Date,
          default: Date.now
        }
      }]
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
      // Remove sensitive data from JSON output
      delete ret.metadata.ip_hash;
      delete ret.metadata.user_agent_hash;
      delete ret.moderation.auto_moderation;
      return ret;
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

// Sparse indexes
commentSchema.index({ 'hierarchy.parent_id': 1 }, { sparse: true });
commentSchema.index({ 'target.chapter_id': 1 }, { sparse: true });

module.exports = commentSchema;
