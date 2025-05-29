/**
 * Jest Test Setup
 * Global configuration and utilities for all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing';

// Increase timeout for database operations
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  /**
   * Generate test JWT token
   */
  generateTestToken: (payload) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  },

  /**
   * Create test user data
   */
  createTestUser: (overrides = {}) => ({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'user',
    level: 5,
    ...overrides
  }),

  /**
   * Create test admin data
   */
  createTestAdmin: (overrides = {}) => ({
    name: 'Test Admin',
    email: 'admin@example.com',
    password: 'hashedpassword',
    role: 'admin',
    permissions: { moderate_comments: true },
    ...overrides
  }),

  /**
   * Create test story data
   */
  createTestStory: (overrides = {}) => ({
    title: 'Test Story',
    slug: 'test-story',
    description: 'Test story description',
    status: 'published',
    ...overrides
  }),

  /**
   * Create test comment data
   */
  createTestComment: (overrides = {}) => ({
    content: {
      original: 'Test comment content',
      sanitized: 'Test comment content'
    },
    target: {
      type: 'story'
    },
    ...overrides
  }),

  /**
   * Wait for specified milliseconds
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random string
   */
  randomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};

// Console log suppression for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console.error and console.warn during tests
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
