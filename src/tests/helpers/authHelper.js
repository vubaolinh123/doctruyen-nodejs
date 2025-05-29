/**
 * Authentication Helper for Tests
 * Utilities for mocking authentication in tests
 */

const jwt = require('jsonwebtoken');

/**
 * Mock authentication middleware
 */
const mockAuthMiddleware = {
  /**
   * Mock authenticateToken middleware
   */
  authenticateToken: (user = null) => {
    return (req, res, next) => {
      if (user) {
        req.user = user;
        next();
      } else {
        res.status(401).json({
          success: false,
          message: 'Vui lòng đăng nhập'
        });
      }
    };
  },

  /**
   * Mock admin authentication
   */
  authenticateAdmin: (admin = null) => {
    return (req, res, next) => {
      if (admin && admin.role === 'admin') {
        req.user = admin;
        next();
      } else {
        res.status(403).json({
          success: false,
          message: 'Bạn không có quyền truy cập'
        });
      }
    };
  }
};

/**
 * Generate test JWT tokens
 */
const tokenHelper = {
  /**
   * Generate user token
   */
  generateUserToken: (userId, role = 'user', permissions = {}) => {
    return jwt.sign(
      { 
        _id: userId, 
        role: role,
        permissions: permissions
      },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );
  },

  /**
   * Generate admin token
   */
  generateAdminToken: (adminId, permissions = { moderate_comments: true }) => {
    return jwt.sign(
      { 
        _id: adminId, 
        role: 'admin',
        permissions: permissions
      },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );
  },

  /**
   * Generate expired token
   */
  generateExpiredToken: (userId) => {
    return jwt.sign(
      { _id: userId, role: 'user' },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '-1h' } // Expired 1 hour ago
    );
  },

  /**
   * Generate invalid token
   */
  generateInvalidToken: () => {
    return 'invalid.jwt.token';
  }
};

/**
 * Test user factory
 */
const userFactory = {
  /**
   * Create test user
   */
  createUser: (overrides = {}) => ({
    _id: require('mongoose').Types.ObjectId(),
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    level: 5,
    permissions: {},
    ...overrides
  }),

  /**
   * Create test admin
   */
  createAdmin: (overrides = {}) => ({
    _id: require('mongoose').Types.ObjectId(),
    name: 'Test Admin',
    email: 'admin@example.com',
    role: 'admin',
    level: 10,
    permissions: {
      moderate_comments: true,
      manage_users: true,
      ...overrides.permissions
    },
    ...overrides
  }),

  /**
   * Create test moderator
   */
  createModerator: (overrides = {}) => ({
    _id: require('mongoose').Types.ObjectId(),
    name: 'Test Moderator',
    email: 'moderator@example.com',
    role: 'moderator',
    level: 8,
    permissions: {
      moderate_comments: true,
      ...overrides.permissions
    },
    ...overrides
  })
};

/**
 * Request helper for authenticated requests
 */
const requestHelper = {
  /**
   * Add auth header to request
   */
  withAuth: (request, token) => {
    return request.set('Authorization', `Bearer ${token}`);
  },

  /**
   * Add user auth to request
   */
  withUser: (request, user) => {
    const token = tokenHelper.generateUserToken(user._id, user.role, user.permissions);
    return request.set('Authorization', `Bearer ${token}`);
  },

  /**
   * Add admin auth to request
   */
  withAdmin: (request, admin) => {
    const token = tokenHelper.generateAdminToken(admin._id, admin.permissions);
    return request.set('Authorization', `Bearer ${token}`);
  }
};

/**
 * Database helper for test data
 */
const dbHelper = {
  /**
   * Clean test data
   */
  cleanTestData: async () => {
    const Comment = require('../../models/comment');
    const User = require('../../models/user');
    const Story = require('../../models/story');

    // Clean test comments
    await Comment.deleteMany({
      'content.original': { $regex: /^(Test|API test|Rate limit test)/ }
    });

    // Clean test users (keep existing ones)
    await User.deleteMany({
      email: { $regex: /@example\.com$/ }
    });

    // Clean test stories
    await Story.deleteMany({
      title: { $regex: /^Test/ }
    });
  },

  /**
   * Create test data
   */
  createTestData: async () => {
    const User = require('../../models/user');
    const Story = require('../../models/story');

    // Create test user if not exists
    let testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      testUser = await User.create(userFactory.createUser());
    }

    // Create test admin if not exists
    let testAdmin = await User.findOne({ email: 'admin@example.com' });
    if (!testAdmin) {
      testAdmin = await User.create(userFactory.createAdmin());
    }

    // Create test story if not exists
    let testStory = await Story.findOne({ slug: 'test-story' });
    if (!testStory) {
      testStory = await Story.create({
        title: 'Test Story',
        slug: 'test-story',
        description: 'Test story for API testing',
        status: 'published',
        author_id: testUser._id
      });
    }

    return { testUser, testAdmin, testStory };
  }
};

module.exports = {
  mockAuthMiddleware,
  tokenHelper,
  userFactory,
  requestHelper,
  dbHelper
};
