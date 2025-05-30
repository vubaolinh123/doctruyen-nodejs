/**
 * Notification System Test Runner
 * Standalone test runner for notification system functionality
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Set timezone
process.env.TZ = 'Asia/Ho_Chi_Minh';

const mongoose = require('mongoose');
const notificationService = require('../services/notificationService');
const Notification = require('../models/notification');
const User = require('../models/user');
const authUtils = require('../utils/authUtils');

// Test database URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/doctruyen';

class NotificationTestRunner {
  constructor() {
    this.testResults = [];
    this.testUsers = {};
  }

  async setup() {
    console.log('🚀 Setting up notification system tests...');
    
    // Connect to database
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Clean up test data
    await Notification.deleteMany({ title: { $regex: /^Test/ } });
    await User.deleteMany({ email: { $regex: /test.*@notification\.test/ } });
    console.log('✓ Cleaned up test data');

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

    this.testUsers = { admin: adminUser, user: regularUser };
    console.log('✓ Created test users');
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    
    // Remove test data
    await Notification.deleteMany({ title: { $regex: /^Test/ } });
    await User.deleteMany({ email: { $regex: /test.*@notification\.test/ } });
    
    // Close database connection
    await mongoose.connection.close();
    console.log('✓ Cleanup completed');
  }

  async runTest(testName, testFunction) {
    try {
      console.log(`\n🧪 Running: ${testName}`);
      await testFunction();
      console.log(`✅ PASSED: ${testName}`);
      this.testResults.push({ name: testName, status: 'PASSED' });
    } catch (error) {
      console.error(`❌ FAILED: ${testName}`);
      console.error(`   Error: ${error.message}`);
      this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
    }
  }

  async testAuthUtils() {
    // Test admin role checking
    if (!authUtils.isAdminRole('admin')) throw new Error('Admin role check failed');
    if (!authUtils.isAdminRole(2)) throw new Error('Admin role numeric check failed');
    if (authUtils.isAdminRole('user')) throw new Error('User role should not be admin');
    
    // Test permission checking
    if (!authUtils.hasPermission('admin', 'user')) throw new Error('Admin should have user permissions');
    if (authUtils.hasPermission('user', 'admin')) throw new Error('User should not have admin permissions');
  }

  async testNotificationCreation() {
    const result = await notificationService.createNotification({
      recipient_id: this.testUsers.user._id,
      type: 'comment_reply',
      title: 'Test Notification Creation',
      message: 'Test notification message'
    });

    if (!result.success) throw new Error('Failed to create notification');
    if (result.data.title !== 'Test Notification Creation') throw new Error('Notification title mismatch');
  }

  async testNotificationTypes() {
    const types = [
      'comment_reply', 'comment_like', 'story_update', 'system_announcement',
      'user_follow', 'achievement_unlock', 'reward_received'
    ];

    for (const type of types) {
      const result = await notificationService.createNotification({
        recipient_id: this.testUsers.user._id,
        type: type,
        title: `Test ${type}`,
        message: `Test message for ${type}`
      });

      if (!result.success) throw new Error(`Failed to create ${type} notification`);
      if (result.data.type !== type) throw new Error(`Type mismatch for ${type}`);
    }
  }

  async testNotificationRetrieval() {
    // Create test notifications
    await notificationService.createNotification({
      recipient_id: this.testUsers.user._id,
      type: 'comment_reply',
      title: 'Test Retrieval 1',
      message: 'Test message 1'
    });

    await notificationService.createNotification({
      recipient_id: this.testUsers.user._id,
      type: 'story_update',
      title: 'Test Retrieval 2',
      message: 'Test message 2'
    });

    const result = await notificationService.getUserNotifications(this.testUsers.user._id, {
      limit: 10,
      skip: 0
    });

    if (!result.success) throw new Error('Failed to retrieve notifications');
    if (result.data.length < 2) throw new Error('Not enough notifications retrieved');
  }

  async testNotificationStatusManagement() {
    // Create notification
    const createResult = await notificationService.createNotification({
      recipient_id: this.testUsers.user._id,
      type: 'user_follow',
      title: 'Test Status Management',
      message: 'Test status message'
    });

    const notificationId = createResult.data._id;

    // Test mark as read
    const readResult = await notificationService.markAsRead(notificationId, this.testUsers.user._id);
    if (!readResult.success) throw new Error('Failed to mark as read');
    if (readResult.data.status !== 'read') throw new Error('Status not updated to read');

    // Test archive
    const archiveResult = await notificationService.archiveNotification(notificationId, this.testUsers.user._id);
    if (!archiveResult.success) throw new Error('Failed to archive notification');
    if (archiveResult.data.status !== 'archived') throw new Error('Status not updated to archived');
  }

  async testCommentIntegration() {
    const parentComment = {
      _id: new mongoose.Types.ObjectId(),
      user_id: this.testUsers.user._id,
      content: { original: 'test parent comment' },
      target: { story_id: new mongoose.Types.ObjectId() }
    };

    const replyComment = {
      _id: new mongoose.Types.ObjectId(),
      user_id: this.testUsers.admin._id,
      content: { original: 'test reply comment' },
      target: { story_id: parentComment.target.story_id },
      hierarchy: { parent_id: parentComment._id }
    };

    const result = await notificationService.createCommentReplyNotification({
      parentComment: parentComment,
      replyComment: replyComment,
      repliedBy: this.testUsers.admin
    });

    if (!result.success) throw new Error('Failed to create comment reply notification');
  }

  async testSystemAnnouncement() {
    const result = await notificationService.createSystemAnnouncement({
      title: 'Test System Announcement',
      message: 'Test announcement message',
      targetUsers: [this.testUsers.user._id, this.testUsers.admin._id],
      priority: 'high'
    });

    if (!result.success) throw new Error('Failed to create system announcement');
    if (result.data.created !== 2) throw new Error('Incorrect number of announcements created');
  }

  async testUnreadCount() {
    // Create unread notification
    await notificationService.createNotification({
      recipient_id: this.testUsers.user._id,
      type: 'comment_like',
      title: 'Test Unread Count',
      message: 'Test unread message'
    });

    const result = await notificationService.getUnreadCount(this.testUsers.user._id);
    if (!result.success) throw new Error('Failed to get unread count');
    if (result.data.count < 1) throw new Error('Unread count should be at least 1');
  }

  async testBulkOperations() {
    // Create multiple notifications
    const notifications = [];
    for (let i = 0; i < 5; i++) {
      notifications.push({
        recipient_id: this.testUsers.user._id,
        type: 'system_announcement',
        title: `Test Bulk ${i + 1}`,
        message: `Bulk message ${i + 1}`
      });
    }

    const result = await Notification.bulkCreate(notifications);
    if (result.length !== 5) throw new Error('Bulk creation failed');

    // Test mark all as read
    const markAllResult = await notificationService.markAllAsRead(this.testUsers.user._id);
    if (!markAllResult.success) throw new Error('Failed to mark all as read');
  }

  async runAllTests() {
    console.log('🎯 Starting Notification System Comprehensive Tests\n');

    await this.setup();

    // Run all tests
    await this.runTest('Auth Utils Functions', () => this.testAuthUtils());
    await this.runTest('Notification Creation', () => this.testNotificationCreation());
    await this.runTest('All Notification Types', () => this.testNotificationTypes());
    await this.runTest('Notification Retrieval', () => this.testNotificationRetrieval());
    await this.runTest('Status Management', () => this.testNotificationStatusManagement());
    await this.runTest('Comment Integration', () => this.testCommentIntegration());
    await this.runTest('System Announcements', () => this.testSystemAnnouncement());
    await this.runTest('Unread Count', () => this.testUnreadCount());
    await this.runTest('Bulk Operations', () => this.testBulkOperations());

    await this.cleanup();

    // Print results
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => r.status === 'FAILED').forEach(test => {
        console.log(`   - ${test.name}: ${test.error}`);
      });
    }

    console.log('\n🎉 Notification System Tests Completed!');
    return failed === 0;
  }
}

// Run tests if called directly
if (require.main === module) {
  const runner = new NotificationTestRunner();
  runner.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = NotificationTestRunner;
