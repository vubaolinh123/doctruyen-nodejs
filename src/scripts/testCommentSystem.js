const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Comment = require('../models/comment');
const User = require('../models/user');
const Story = require('../models/story');

/**
 * Script để test hệ thống comment mới
 */
async function testCommentSystem() {
  try {
    console.log('🚀 Bắt đầu test hệ thống comment...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Kết nối MongoDB thành công');

    // Test 1: Tạo comment gốc
    console.log('\n📝 Test 1: Tạo comment gốc...');

    // Find a test user and story
    const testUser = await User.findOne().limit(1);
    const testStory = await Story.findOne().limit(1);

    if (!testUser || !testStory) {
      console.log('❌ Không tìm thấy user hoặc story để test');
      return;
    }

    const rootComment = new Comment({
      user_id: testUser._id,
      target: {
        story_id: testStory._id,
        type: 'story'
      },
      content: {
        original: 'Đây là comment test từ hệ thống mới! 🎉',
        sanitized: 'Đây là comment test từ hệ thống mới! 🎉'
      }
    });

    await rootComment.save();
    console.log('✅ Tạo root comment thành công:', rootComment._id);

    // Test 2: Tạo reply comment
    console.log('\n💬 Test 2: Tạo reply comment...');

    const replyComment = new Comment({
      user_id: testUser._id,
      target: {
        story_id: testStory._id,
        type: 'story'
      },
      content: {
        original: 'Đây là reply cho comment trên!',
        sanitized: 'Đây là reply cho comment trên!'
      },
      hierarchy: {
        parent_id: rootComment._id
      }
    });

    await replyComment.save();
    console.log('✅ Tạo reply comment thành công:', replyComment._id);

    // Test 3: Test like functionality
    console.log('\n👍 Test 3: Test like functionality...');

    const likeResult = await rootComment.addLike(testUser._id);
    console.log('✅ Like result:', likeResult);

    // Test 4: Test static methods
    console.log('\n📊 Test 4: Test static methods...');

    const storyComments = await Comment.getStoryComments({
      story_id: testStory._id,
      limit: 5
    });
    console.log('✅ Story comments:', storyComments.comments.length, 'comments found');

    // Test 5: Test comment thread
    console.log('\n🧵 Test 5: Test comment thread...');

    const thread = await Comment.getCommentThread(rootComment._id);
    console.log('✅ Comment thread:', thread ? 'Found' : 'Not found');

    // Test 6: Test search
    console.log('\n🔍 Test 6: Test search...');

    const searchResults = await Comment.searchComments({
      query: 'test',
      limit: 5
    });
    console.log('✅ Search results:', searchResults.comments.length, 'comments found');

    // Test 7: Test stats
    console.log('\n📈 Test 7: Test stats...');

    const stats = await Comment.getCommentStats({
      story_id: testStory._id
    });
    console.log('✅ Comment stats:', stats);

    // Test 8: Test moderation
    console.log('\n🛡️ Test 8: Test moderation...');

    const flagResult = await rootComment.addFlag(testUser._id, 'spam');
    console.log('✅ Flag result:', flagResult);

    // Test 9: Test engagement score calculation
    console.log('\n⚡ Test 9: Test engagement score...');

    rootComment.updateEngagementScore();
    console.log('✅ Engagement score:', rootComment.engagement.score);

    // Test 10: Test virtual fields
    console.log('\n🔗 Test 10: Test virtual fields...');

    await rootComment.populate('user_id', 'name');
    console.log('✅ Virtual user:', rootComment.user_id.name);
    console.log('✅ Age readable:', rootComment.ageReadable);
    console.log('✅ Is hot:', rootComment.isHot);
    console.log('✅ Content preview:', rootComment.contentPreview);

    console.log('\n🎉 Tất cả tests đã hoàn thành thành công!');

    // Cleanup test data
    console.log('\n🧹 Dọn dẹp test data...');
    await Comment.deleteMany({
      _id: { $in: [rootComment._id, replyComment._id] }
    });
    console.log('✅ Đã xóa test data');

  } catch (error) {
    console.error('❌ Lỗi trong quá trình test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');
  }
}

/**
 * Test performance với large dataset
 */
async function testPerformance() {
  try {
    console.log('\n🚀 Bắt đầu test performance...');

    await mongoose.connect(process.env.MONGODB_URI);

    const testUser = await User.findOne().limit(1);
    const testStory = await Story.findOne().limit(1);

    if (!testUser || !testStory) {
      console.log('❌ Không tìm thấy user hoặc story để test');
      return;
    }

    // Create multiple comments for performance testing
    console.log('📝 Tạo 100 comments để test performance...');

    const comments = [];
    for (let i = 0; i < 100; i++) {
      const content = `Performance test comment ${i + 1}`;
      comments.push({
        user_id: testUser._id,
        target: {
          story_id: testStory._id,
          type: 'story'
        },
        content: {
          original: content,
          sanitized: content
        }
      });
    }

    const startTime = Date.now();
    await Comment.insertMany(comments);
    const insertTime = Date.now() - startTime;
    console.log(`✅ Insert 100 comments: ${insertTime}ms`);

    // Test query performance
    const queryStartTime = Date.now();
    const result = await Comment.getStoryComments({
      story_id: testStory._id,
      limit: 20
    });
    const queryTime = Date.now() - queryStartTime;
    console.log(`✅ Query 20 comments: ${queryTime}ms`);

    // Cleanup
    await Comment.deleteMany({
      'content.original': { $regex: /^Performance test comment/ }
    });
    console.log('✅ Đã xóa performance test data');

  } catch (error) {
    console.error('❌ Lỗi performance test:', error);
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Test spam detection
 */
async function testSpamDetection() {
  try {
    console.log('\n🚀 Bắt đầu test spam detection...');

    await mongoose.connect(process.env.MONGODB_URI);

    const moderationService = require('../services/comment/moderationService');

    // Test spam content
    const spamContent = 'CLICK HERE FOR FREE MONEY!!! http://spam.com';
    const spamScore = moderationService.calculateSpamScore(spamContent);
    console.log(`✅ Spam score for spam content: ${spamScore}`);

    // Test normal content
    const normalContent = 'Truyện này hay quá, tôi rất thích!';
    const normalScore = moderationService.calculateSpamScore(normalContent);
    console.log(`✅ Spam score for normal content: ${normalScore}`);

    // Test toxic content
    const toxicContent = 'Đm thằng ngu này viết truyện gì mà dở thế';
    const toxicScore = moderationService.calculateToxicityScore(toxicContent);
    console.log(`✅ Toxicity score for toxic content: ${toxicScore}`);

    // Test normal content toxicity
    const normalToxicScore = moderationService.calculateToxicityScore(normalContent);
    console.log(`✅ Toxicity score for normal content: ${normalToxicScore}`);

  } catch (error) {
    console.error('❌ Lỗi spam detection test:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run tests
if (require.main === module) {
  const testType = process.argv[2] || 'basic';

  switch (testType) {
    case 'basic':
      testCommentSystem();
      break;
    case 'performance':
      testPerformance();
      break;
    case 'spam':
      testSpamDetection();
      break;
    case 'all':
      (async () => {
        await testCommentSystem();
        await testPerformance();
        await testSpamDetection();
      })();
      break;
    default:
      console.log('Usage: node testCommentSystem.js [basic|performance|spam|all]');
  }
}

module.exports = {
  testCommentSystem,
  testPerformance,
  testSpamDetection
};
