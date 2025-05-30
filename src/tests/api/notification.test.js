/**
 * Comprehensive Notification System Tests
 * Tests all notification functionality including API endpoints, authentication, and database operations
 */

const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const routes = require('../../routes');
const authRoutes = require('../../routes/auth');
const errorHandler = require('../../middleware/errorHandler');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api', routes);
app.use(errorHandler);
const Notification = require('../../models/notification');
const User = require('../../models/user');
const Comment = require('../../models/comment');
const notificationService = require('../../services/notificationService');
const jwt = require('jsonwebtoken');

// Test database setup
const MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/doctruyen_test';

describe('Notification System Tests', () => {
  let server;
  let testUsers = {};
  let testTokens = {};
  let testNotifications = [];
  let testComments = [];

  // Setup before all tests
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    // Clear test data
    await Notification.deleteMany({});
    await User.deleteMany({ email: { $regex: /test.*@notification\.test/ } });
    await Comment.deleteMany({ 'content.original': { $regex: /test notification/ } });

    // Create test users
    const adminUser = await User.create({
      name: 'Test Admin',
      email: 'test.admin@notification.test',
      password: 'hashedpassword123',
      role: 'admin',
      isActive: true,
      slug: 'test-admin-notification'
    });

    const regularUser = await User.create({
      name: 'Test User',
      email: 'test.user@notification.test',
      password: 'hashedpassword123',
      role: 'user',
      isActive: true,
      slug: 'test-user-notification'
    });

    const authorUser = await User.create({
      name: 'Test Author',
      email: 'test.author@notification.test',
      password: 'hashedpassword123',
      role: 'author',
      isActive: true,
      slug: 'test-author-notification'
    });

    testUsers = { admin: adminUser, user: regularUser, author: authorUser };

    // Generate test tokens
    testTokens = {
      admin: jwt.sign(
        { id: adminUser._id, email: adminUser.email, role: adminUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      ),
      user: jwt.sign(
        { id: regularUser._id, email: regularUser.email, role: regularUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      ),
      author: jwt.sign(
        { id: authorUser._id, email: authorUser.email, role: authorUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      )
    };

    console.log('✓ Test setup completed');
  });

  // Cleanup after all tests
  afterAll(async () => {
    // Clean up test data
    await Notification.deleteMany({});
    await User.deleteMany({ email: { $regex: /test.*@notification\.test/ } });
    await Comment.deleteMany({ 'content.original': { $regex: /test notification/ } });

    // Close database connection
    await mongoose.connection.close();
    console.log('✓ Test cleanup completed');
  });

  // Clear notifications before each test
  beforeEach(async () => {
    await Notification.deleteMany({ recipient_id: { $in: Object.values(testUsers).map(u => u._id) } });
    testNotifications = [];
  });

  describe('1. Authentication & Authorization Tests', () => {
    test('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });

    test('should accept valid authentication token', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${testTokens.user}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should require admin role for admin endpoints', async () => {
      const response = await request(app)
        .post('/api/notifications/announcement')
        .set('Authorization', `Bearer ${testTokens.user}`)
        .send({
          title: 'Test Announcement',
          message: 'Test message'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('quyền');
    });

    test('should allow admin access to admin endpoints', async () => {
      const response = await request(app)
        .post('/api/notifications/announcement')
        .set('Authorization', `Bearer ${testTokens.admin}`)
        .send({
          title: 'Test Admin Announcement',
          message: 'Test admin message',
          targetUsers: [testUsers.user._id]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('2. Notification CRUD Operations', () => {
    test('should create notification via service', async () => {
      const notificationData = {
        recipient_id: testUsers.user._id,
        type: 'comment_reply',
        title: 'Test Notification',
        message: 'Test notification message',
        data: {
          comment_id: new mongoose.Types.ObjectId(),
          sender_id: testUsers.admin._id
        }
      };

      const result = await notificationService.createNotification(notificationData);
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Test Notification');

      testNotifications.push(result.data);
    });

    test('should get user notifications with pagination', async () => {
      // Create multiple notifications
      for (let i = 0; i < 5; i++) {
        await notificationService.createNotification({
          recipient_id: testUsers.user._id,
          type: 'system_announcement',
          title: `Test Notification ${i + 1}`,
          message: `Test message ${i + 1}`
        });
      }

      const response = await request(app)
        .get('/api/notifications?limit=3&skip=0')
        .set('Authorization', `Bearer ${testTokens.user}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination.total).toBe(5);
      expect(response.body.pagination.hasMore).toBe(true);
    });

    test('should filter notifications by type', async () => {
      // Create notifications of different types
      await notificationService.createNotification({
        recipient_id: testUsers.user._id,
        type: 'comment_reply',
        title: 'Comment Reply',
        message: 'Someone replied to your comment'
      });

      await notificationService.createNotification({
        recipient_id: testUsers.user._id,
        type: 'story_update',
        title: 'Story Update',
        message: 'New chapter available'
      });

      const response = await request(app)
        .get('/api/notifications?type=comment_reply')
        .set('Authorization', `Bearer ${testTokens.user}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every(n => n.type === 'comment_reply')).toBe(true);
    });

    test('should get unread notification count', async () => {
      // Create unread notifications
      await notificationService.createNotification({
        recipient_id: testUsers.user._id,
        type: 'comment_like',
        title: 'Comment Liked',
        message: 'Someone liked your comment'
      });

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${testTokens.user}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
    });
  });

  describe('3. Notification Status Management', () => {
    let testNotification;

    beforeEach(async () => {
      const result = await notificationService.createNotification({
        recipient_id: testUsers.user._id,
        type: 'user_follow',
        title: 'New Follower',
        message: 'Someone started following you'
      });
      testNotification = result.data;
    });

    test('should mark notification as read', async () => {
      const response = await request(app)
        .put(`/api/notifications/${testNotification._id}/read`)
        .set('Authorization', `Bearer ${testTokens.user}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('read');
    });

    test('should mark multiple notifications as read', async () => {
      // Create another notification
      const result2 = await notificationService.createNotification({
        recipient_id: testUsers.user._id,
        type: 'achievement_unlock',
        title: 'Achievement Unlocked',
        message: 'You unlocked a new achievement'
      });

      const response = await request(app)
        .put('/api/notifications/mark-read')
        .set('Authorization', `Bearer ${testTokens.user}`)
        .send({
          notificationIds: [testNotification._id, result2.data._id]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.modifiedCount).toBe(2);
    });

    test('should mark all notifications as read', async () => {
      // Create multiple notifications
      await notificationService.createNotification({
        recipient_id: testUsers.user._id,
        type: 'reward_received',
        title: 'Reward Received',
        message: 'You received coins'
      });

      const response = await request(app)
        .put('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${testTokens.user}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.modifiedCount).toBeGreaterThan(0);
    });

    test('should archive notification', async () => {
      const response = await request(app)
        .put(`/api/notifications/${testNotification._id}/archive`)
        .set('Authorization', `Bearer ${testTokens.user}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('archived');
    });

    test('should delete notification', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${testNotification._id}`)
        .set('Authorization', `Bearer ${testTokens.user}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('4. Comment Integration Tests', () => {
    test('should create comment reply notification', async () => {
      // Create parent comment
      const parentComment = {
        _id: new mongoose.Types.ObjectId(),
        user_id: testUsers.user._id,
        content: { original: 'test notification parent comment' },
        target: { story_id: new mongoose.Types.ObjectId() }
      };

      // Create reply comment
      const replyComment = {
        _id: new mongoose.Types.ObjectId(),
        user_id: testUsers.author._id,
        content: { original: 'test notification reply comment' },
        target: { story_id: parentComment.target.story_id },
        hierarchy: { parent_id: parentComment._id }
      };

      const result = await notificationService.createCommentReplyNotification({
        parentComment: parentComment,
        replyComment: replyComment,
        repliedBy: testUsers.author
      });

      expect(result.success).toBe(true);
    });

    test('should create comment like notification', async () => {
      const comment = {
        _id: new mongoose.Types.ObjectId(),
        user_id: testUsers.user._id,
        content: { original: 'test notification liked comment' },
        target: { story_id: new mongoose.Types.ObjectId() }
      };

      const result = await notificationService.createCommentLikeNotification({
        comment: comment,
        likedBy: testUsers.author
      });

      expect(result.success).toBe(true);
    });

    test('should not create notification for self-actions', async () => {
      const comment = {
        _id: new mongoose.Types.ObjectId(),
        user_id: testUsers.user._id,
        content: { original: 'test notification self comment' },
        target: { story_id: new mongoose.Types.ObjectId() }
      };

      const result = await notificationService.createCommentLikeNotification({
        comment: comment,
        likedBy: testUsers.user // Same user
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('self');
    });
  });

  describe('5. Notification Types Tests', () => {
    const notificationTypes = [
      'comment_reply', 'comment_like', 'comment_mention',
      'story_update', 'story_like', 'story_follow', 'chapter_release',
      'system_announcement', 'user_follow', 'achievement_unlock',
      'reward_received', 'attendance_reminder', 'moderation_action', 'admin_message'
    ];

    test('should support all notification types', async () => {
      for (const type of notificationTypes) {
        const result = await notificationService.createNotification({
          recipient_id: testUsers.user._id,
          type: type,
          title: `Test ${type}`,
          message: `Test message for ${type}`
        });

        expect(result.success).toBe(true);
        expect(result.data.type).toBe(type);
      }
    });

    test('should auto-categorize notification types', async () => {
      const typeCategories = {
        'comment_reply': 'social',
        'story_update': 'content',
        'system_announcement': 'system',
        'achievement_unlock': 'achievement',
        'moderation_action': 'moderation'
      };

      for (const [type, expectedCategory] of Object.entries(typeCategories)) {
        const result = await notificationService.createNotification({
          recipient_id: testUsers.user._id,
          type: type,
          title: `Test ${type}`,
          message: `Test message for ${type}`
        });

        expect(result.data.category).toBe(expectedCategory);
      }
    });
  });

  describe('6. Admin Features Tests', () => {
    test('should create system announcement for all users', async () => {
      const response = await request(app)
        .post('/api/notifications/announcement')
        .set('Authorization', `Bearer ${testTokens.admin}`)
        .send({
          title: 'System Maintenance',
          message: 'System will be down for maintenance',
          targetUsers: 'all',
          priority: 'high'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.created).toBeGreaterThan(0);
    });

    test('should create targeted announcement', async () => {
      const response = await request(app)
        .post('/api/notifications/announcement')
        .set('Authorization', `Bearer ${testTokens.admin}`)
        .send({
          title: 'Targeted Announcement',
          message: 'This is for specific users',
          targetUsers: [testUsers.user._id, testUsers.author._id],
          priority: 'normal'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.created).toBe(2);
    });

    test('should cleanup expired notifications', async () => {
      // Create expired notification
      const expiredNotification = await Notification.create({
        recipient_id: testUsers.user._id,
        type: 'system_announcement',
        title: 'Expired Notification',
        message: 'This should be cleaned up',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      });

      const response = await request(app)
        .post('/api/notifications/cleanup')
        .set('Authorization', `Bearer ${testTokens.admin}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('7. Error Handling Tests', () => {
    test('should handle invalid notification ID', async () => {
      const response = await request(app)
        .put('/api/notifications/invalid-id/read')
        .set('Authorization', `Bearer ${testTokens.user}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('should handle unauthorized notification access', async () => {
      // Create notification for user1
      const result = await notificationService.createNotification({
        recipient_id: testUsers.user._id,
        type: 'comment_reply',
        title: 'Private Notification',
        message: 'This is private'
      });

      // Try to access with different user token
      const response = await request(app)
        .put(`/api/notifications/${result.data._id}/read`)
        .set('Authorization', `Bearer ${testTokens.author}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('should validate required fields for announcements', async () => {
      const response = await request(app)
        .post('/api/notifications/announcement')
        .set('Authorization', `Bearer ${testTokens.admin}`)
        .send({
          // Missing title and message
          targetUsers: 'all'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('bắt buộc');
    });
  });

  describe('8. Performance & Statistics Tests', () => {
    test('should get notification statistics', async () => {
      // Create notifications of different types
      await notificationService.createNotification({
        recipient_id: testUsers.user._id,
        type: 'comment_reply',
        title: 'Stats Test 1',
        message: 'Test message 1'
      });

      await notificationService.createNotification({
        recipient_id: testUsers.user._id,
        type: 'story_update',
        title: 'Stats Test 2',
        message: 'Test message 2'
      });

      const response = await request(app)
        .get('/api/notifications/stats?days=7')
        .set('Authorization', `Bearer ${testTokens.user}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should handle bulk notification creation', async () => {
      const userIds = [testUsers.user._id, testUsers.author._id];
      const notifications = userIds.map(userId => ({
        recipient_id: userId,
        type: 'system_announcement',
        title: 'Bulk Test',
        message: 'Bulk notification test'
      }));

      const result = await Notification.bulkCreate(notifications);
      expect(result.length).toBe(2);
    });
  });
});
