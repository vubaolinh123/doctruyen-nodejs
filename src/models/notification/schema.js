const mongoose = require('mongoose');

/**
 * Notification Schema
 * Comprehensive notification system for all app features
 */
const notificationSchema = new mongoose.Schema({
  // Recipient information
  recipient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Notification type and categorization
  type: {
    type: String,
    required: true,
    enum: [
      'comment_reply',
      'comment_like',
      'comment_mention',
      'story_update',
      'story_like',
      'story_follow',
      'chapter_release',
      'system_announcement',
      'user_follow',
      'achievement_unlock',
      'reward_received',
      'attendance_reminder',
      'moderation_action',
      'admin_message'
    ],
    index: true
  },

  category: {
    type: String,
    enum: ['social', 'content', 'system', 'achievement', 'moderation'],
    default: function() {
      const categoryMap = {
        'comment_reply': 'social',
        'comment_like': 'social',
        'comment_mention': 'social',
        'user_follow': 'social',
        'story_update': 'content',
        'story_like': 'content',
        'story_follow': 'content',
        'chapter_release': 'content',
        'achievement_unlock': 'achievement',
        'reward_received': 'achievement',
        'attendance_reminder': 'system',
        'system_announcement': 'system',
        'moderation_action': 'moderation',
        'admin_message': 'moderation'
      };
      return categoryMap[this.type] || 'system';
    },
    index: true
  },

  // Notification content
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },

  message: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true
  },

  // Rich content data
  data: {
    // Comment-related data
    comment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
    parent_comment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
    
    // Story/Chapter-related data
    story_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' },
    chapter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    
    // User-related data
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    mentioned_users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    // Achievement/Reward data
    achievement_id: { type: mongoose.Schema.Types.ObjectId },
    reward_amount: { type: Number },
    reward_type: { type: String, enum: ['coins', 'exp', 'badge'] },
    
    // Additional metadata
    metadata: { type: mongoose.Schema.Types.Mixed }
  },

  // Navigation and action
  url: {
    type: String,
    trim: true
  },

  action_url: {
    type: String,
    trim: true
  },

  // Status and tracking
  status: {
    type: String,
    enum: ['unread', 'read', 'archived', 'deleted'],
    default: 'unread',
    index: true
  },

  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },

  // Delivery tracking
  delivery: {
    in_app: {
      delivered: { type: Boolean, default: false },
      delivered_at: { type: Date }
    },
    email: {
      enabled: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      delivered_at: { type: Date },
      failed_reason: { type: String }
    },
    push: {
      enabled: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      delivered_at: { type: Date },
      failed_reason: { type: String }
    }
  },

  // Interaction tracking
  interactions: {
    read_at: { type: Date },
    clicked_at: { type: Date },
    dismissed_at: { type: Date },
    action_taken: { type: String }
  },

  // Expiration and cleanup
  expires_at: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },

  // Timestamps
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },

  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'notifications'
});

// Compound indexes for efficient querying
notificationSchema.index({ recipient_id: 1, status: 1, created_at: -1 });
notificationSchema.index({ recipient_id: 1, type: 1, created_at: -1 });
notificationSchema.index({ recipient_id: 1, category: 1, status: 1 });
notificationSchema.index({ type: 1, created_at: -1 });
notificationSchema.index({ status: 1, priority: 1, created_at: -1 });

// Text index for search functionality
notificationSchema.index({ 
  title: 'text', 
  message: 'text' 
}, {
  weights: { title: 2, message: 1 }
});

module.exports = notificationSchema;
