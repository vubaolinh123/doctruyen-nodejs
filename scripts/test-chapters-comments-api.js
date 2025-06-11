#!/usr/bin/env node

/**
 * Complete Testing Script for Chapters with Comments API
 * Tests the /api/admin/comments/chapters endpoint end-to-end
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const bcrypt = require('bcrypt');

// Load environment variables
require('dotenv').config();

// API Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/doctruyen';

// Test configuration
const TEST_CONFIG = {
  adminUser: {
    name: 'Test Admin',
    email: 'test-admin-chapters@example.com',
    password: 'testpassword123',
    role: 'admin'
  },
  testStory: {
    name: 'Test Story for Chapter Comments',
    slug: 'test-story-for-chapter-comments',
    desc: 'A test story to validate chapter comment aggregation',
    status: true
  },
  testChapter: {
    name: 'Test Chapter 1',
    slug: 'test-chapter-1',
    chapter: 1,
    content: 'This is test chapter content',
    status: true
  },
  testComment: {
    content: {
      original: 'This is a test comment for chapter API validation'
    },
    target: {
      type: 'chapter'
    },
    moderation: {
      status: 'active',
      flags: {
        count: 0,
        reasons: [],
        flagged_by: []
      }
    },
    engagement: {
      likes: { count: 0, users: [] },
      dislikes: { count: 0, users: [] },
      replies: { count: 0 },
      score: 0
    },
    hierarchy: {
      level: 0,
      path: ''
    }
  }
};

class ChaptersAPITester {
  constructor() {
    this.adminToken = null;
    this.testUserId = null;
    this.testStoryId = null;
    this.testChapterId = null;
    this.testCommentId = null;
  }

  async connect() {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  }

  async disconnect() {
    console.log('🔌 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }

  async createTestUser() {
    console.log('👤 Creating test admin user...');
    
    const User = require('../src/models/user');
    
    // Check if test user already exists
    let testUser = await User.findOne({ email: TEST_CONFIG.adminUser.email });
    
    if (!testUser) {
      const hashedPassword = await bcrypt.hash(TEST_CONFIG.adminUser.password, 10);
      
      testUser = new User({
        ...TEST_CONFIG.adminUser,
        password: hashedPassword,
        slug: 'test-admin-chapters',
        isVerified: true
      });
      
      await testUser.save();
      console.log('✅ Test admin user created');
    } else {
      console.log('✅ Test admin user already exists');
    }
    
    this.testUserId = testUser._id;
    
    // Generate JWT token
    this.adminToken = jwt.sign(
      {
        id: testUser._id,
        email: testUser.email,
        role: testUser.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('🔑 JWT Secret used:', JWT_SECRET.substring(0, 10) + '...');
    console.log('🔑 Generated token for user:', testUser.email, 'role:', testUser.role);
    
    console.log('✅ Admin JWT token generated');
    return testUser;
  }

  async createTestStory() {
    console.log('📚 Creating test story...');
    
    const Story = require('../src/models/story');
    
    // Check if test story already exists
    let testStory = await Story.findOne({ slug: TEST_CONFIG.testStory.slug });
    
    if (!testStory) {
      testStory = new Story({
        ...TEST_CONFIG.testStory,
        author_id: [this.testUserId],
        categories: [],
        image: 'https://example.com/test-cover.jpg'
      });
      
      await testStory.save();
      console.log('✅ Test story created');
    } else {
      console.log('✅ Test story already exists');
    }
    
    this.testStoryId = testStory._id;
    return testStory;
  }

  async createTestChapter() {
    console.log('📖 Creating test chapter...');
    
    const Chapter = require('../src/models/chapter');
    
    // Check if test chapter already exists
    let testChapter = await Chapter.findOne({ 
      story_id: this.testStoryId,
      slug: TEST_CONFIG.testChapter.slug 
    });
    
    if (!testChapter) {
      testChapter = new Chapter({
        ...TEST_CONFIG.testChapter,
        story_id: this.testStoryId
      });
      
      await testChapter.save();
      console.log('✅ Test chapter created');
    } else {
      console.log('✅ Test chapter already exists');
    }
    
    this.testChapterId = testChapter._id;
    return testChapter;
  }

  async createTestComment() {
    console.log('💬 Creating test comment...');
    
    const Comment = require('../src/models/comment');
    
    // Check if test comment already exists
    let testComment = await Comment.findOne({ 
      user_id: this.testUserId,
      'target.chapter_id': this.testChapterId 
    });
    
    if (!testComment) {
      testComment = new Comment({
        ...TEST_CONFIG.testComment,
        user_id: this.testUserId,
        target: {
          ...TEST_CONFIG.testComment.target,
          story_id: this.testStoryId,
          chapter_id: this.testChapterId
        }
      });
      
      await testComment.save();
      console.log('✅ Test comment created');
    } else {
      console.log('✅ Test comment already exists');
    }
    
    this.testCommentId = testComment._id;
    return testComment;
  }

  async setupTestData() {
    console.log('🏗️ Setting up test data...');
    
    await this.createTestUser();
    await this.createTestStory();
    await this.createTestChapter();
    await this.createTestComment();
    
    console.log('✅ Test data setup complete');
  }

  async testChaptersAPI() {
    console.log('🧪 Testing Chapters with Comments API...');
    
    const testCases = [
      {
        name: 'Basic API call',
        params: {
          page: 1,
          limit: 10,
          sort: 'totalComments',
          direction: 'desc'
        }
      },
      {
        name: 'Search by chapter name',
        params: {
          page: 1,
          limit: 10,
          search: 'Test Chapter',
          sort: 'totalComments',
          direction: 'desc'
        }
      },
      {
        name: 'Filter by story',
        params: {
          page: 1,
          limit: 10,
          story_id: this.testStoryId.toString(),
          sort: 'totalComments',
          direction: 'desc'
        }
      },
      {
        name: 'Sort by chapter number',
        params: {
          page: 1,
          limit: 10,
          sort: 'chapter',
          direction: 'asc'
        }
      },
      {
        name: 'Sort by chapter name',
        params: {
          page: 1,
          limit: 10,
          sort: 'name',
          direction: 'asc'
        }
      }
    ];

    const results = [];

    for (const testCase of testCases) {
      console.log(`\n📋 Testing: ${testCase.name}`);
      
      try {
        const response = await axios.get(`${API_BASE_URL}/api/admin/comments/chapters`, {
          params: testCase.params,
          headers: {
            'Authorization': `Bearer ${this.adminToken}`,
            'Content-Type': 'application/json'
          }
        });

        const result = {
          name: testCase.name,
          success: true,
          status: response.status,
          dataCount: response.data.data?.length || 0,
          hasTestChapter: false,
          pagination: response.data.pagination
        };

        // Check if our test chapter is in the results
        if (response.data.data) {
          result.hasTestChapter = response.data.data.some(chapter => 
            chapter._id === this.testChapterId.toString()
          );
        }

        console.log(`✅ ${testCase.name}: ${result.dataCount} chapters found`);
        console.log(`   Test chapter included: ${result.hasTestChapter}`);
        
        if (result.dataCount > 0) {
          const firstChapter = response.data.data[0];
          console.log(`   First chapter: ${firstChapter.name} (Chapter ${firstChapter.chapter}) - ${firstChapter.totalComments} comments`);
          console.log(`   Story: ${firstChapter.story?.name || 'Unknown'}`);
        }

        results.push(result);
        
      } catch (error) {
        console.error(`❌ ${testCase.name} failed:`, error.response?.data || error.message);
        results.push({
          name: testCase.name,
          success: false,
          error: error.response?.data || error.message
        });
      }
    }

    return results;
  }

  async validateAPIResponse(response) {
    console.log('🔍 Validating API response structure...');
    
    const requiredFields = ['success', 'data', 'pagination'];
    const chapterRequiredFields = ['_id', 'name', 'slug', 'chapter', 'story_id', 'story', 'totalComments', 'moderationStatus'];
    
    // Check top-level structure
    for (const field of requiredFields) {
      if (!(field in response)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Check data array
    if (!Array.isArray(response.data)) {
      throw new Error('Data field must be an array');
    }
    
    // Check chapter structure if data exists
    if (response.data.length > 0) {
      const chapter = response.data[0];
      for (const field of chapterRequiredFields) {
        if (!(field in chapter)) {
          throw new Error(`Missing required chapter field: ${field}`);
        }
      }
    }
    
    console.log('✅ API response structure is valid');
  }

  async run() {
    try {
      console.log('🚀 Starting Chapters with Comments API Test Suite\n');
      
      await this.connect();
      await this.setupTestData();
      
      console.log('\n' + '='.repeat(50));
      const results = await this.testChaptersAPI();
      console.log('='.repeat(50));
      
      // Summary
      console.log('\n📊 Test Results Summary:');
      const successful = results.filter(r => r.success).length;
      const total = results.length;
      
      console.log(`✅ Successful tests: ${successful}/${total}`);
      
      if (successful < total) {
        console.log('❌ Some tests failed. Check the logs above for details.');
        process.exit(1);
      } else {
        console.log('🎉 All tests passed successfully!');
      }
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run the test suite
if (require.main === module) {
  const tester = new ChaptersAPITester();
  tester.run().catch(console.error);
}

module.exports = ChaptersAPITester;
