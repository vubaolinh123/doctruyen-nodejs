/**
 * Cache service cho comment system
 * Sử dụng in-memory cache hoặc Redis nếu có
 */

// Simple in-memory cache implementation
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map();
  }

  set(key, value, ttlSeconds = 300) {
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + (ttlSeconds * 1000));
  }

  get(key) {
    const expiry = this.ttl.get(key);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key);
      this.ttl.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.ttl.delete(key);
  }

  clear() {
    this.cache.clear();
    this.ttl.clear();
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.ttl.entries()) {
      if (now > expiry) {
        this.cache.delete(key);
        this.ttl.delete(key);
      }
    }
  }
}

class CommentCacheService {
  constructor() {
    this.cache = new MemoryCache();
    this.cleanupInterval = null;

    // Only start cleanup in production
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => {
        this.cache.cleanup();
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Cleanup interval for testing
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Generate cache key cho comments
   * @param {Object} options - Query options
   * @returns {String} - Cache key
   */
  generateCommentsKey(options) {
    const {
      story_id,
      chapter_id,
      parent_id,
      cursor,
      limit,
      sort,
      include_replies
    } = options;

    const keyParts = ['comments'];

    if (story_id) keyParts.push(`story:${story_id}`);
    if (chapter_id) keyParts.push(`chapter:${chapter_id}`);
    if (parent_id) keyParts.push(`parent:${parent_id}`);
    if (cursor) keyParts.push(`cursor:${cursor}`);
    if (limit) keyParts.push(`limit:${limit}`);
    if (sort) keyParts.push(`sort:${sort}`);
    if (include_replies) keyParts.push(`replies:${include_replies}`);

    return keyParts.join(':');
  }

  /**
   * Generate cache key cho comment thread
   * @param {ObjectId} rootId - Root comment ID
   * @returns {String} - Cache key
   */
  generateThreadKey(rootId) {
    return `thread:${rootId}`;
  }

  /**
   * Generate cache key cho comment stats
   * @param {Object} options - Stats options
   * @returns {String} - Cache key
   */
  generateStatsKey(options) {
    const { story_id, chapter_id, timeRange } = options;
    const keyParts = ['stats'];

    if (story_id) keyParts.push(`story:${story_id}`);
    if (chapter_id) keyParts.push(`chapter:${chapter_id}`);
    if (timeRange) keyParts.push(`range:${timeRange}`);

    return keyParts.join(':');
  }

  /**
   * Cache comments result
   * @param {Object} options - Query options
   * @param {Object} result - Comments result
   * @param {Number} ttl - TTL in seconds
   */
  cacheComments(options, result, ttl = 300) {
    try {
      const key = this.generateCommentsKey(options);
      this.cache.set(key, result, ttl);
    } catch (error) {
      console.error('Error caching comments:', error);
    }
  }

  /**
   * Get cached comments
   * @param {Object} options - Query options
   * @returns {Object|null} - Cached result or null
   */
  getCachedComments(options) {
    try {
      const key = this.generateCommentsKey(options);
      return this.cache.get(key);
    } catch (error) {
      console.error('Error getting cached comments:', error);
      return null;
    }
  }

  /**
   * Cache comment thread
   * @param {ObjectId} rootId - Root comment ID
   * @param {Object} thread - Comment thread
   * @param {Number} ttl - TTL in seconds
   */
  cacheThread(rootId, thread, ttl = 600) {
    try {
      const key = this.generateThreadKey(rootId);
      this.cache.set(key, thread, ttl);
    } catch (error) {
      console.error('Error caching thread:', error);
    }
  }

  /**
   * Get cached comment thread
   * @param {ObjectId} rootId - Root comment ID
   * @returns {Object|null} - Cached thread or null
   */
  getCachedThread(rootId) {
    try {
      const key = this.generateThreadKey(rootId);
      return this.cache.get(key);
    } catch (error) {
      console.error('Error getting cached thread:', error);
      return null;
    }
  }

  /**
   * Cache comment stats
   * @param {Object} options - Stats options
   * @param {Object} stats - Stats result
   * @param {Number} ttl - TTL in seconds
   */
  cacheStats(options, stats, ttl = 900) {
    try {
      const key = this.generateStatsKey(options);
      this.cache.set(key, stats, ttl);
    } catch (error) {
      console.error('Error caching stats:', error);
    }
  }

  /**
   * Get cached comment stats
   * @param {Object} options - Stats options
   * @returns {Object|null} - Cached stats or null
   */
  getCachedStats(options) {
    try {
      const key = this.generateStatsKey(options);
      return this.cache.get(key);
    } catch (error) {
      console.error('Error getting cached stats:', error);
      return null;
    }
  }

  /**
   * Invalidate cache cho story
   * @param {ObjectId} storyId - Story ID
   */
  invalidateStoryCache(storyId) {
    try {
      // Find and delete all cache entries related to this story
      for (const [key] of this.cache.cache.entries()) {
        if (key.includes(`story:${storyId}`)) {
          this.cache.delete(key);
        }
      }
    } catch (error) {
      console.error('Error invalidating story cache:', error);
    }
  }

  /**
   * Invalidate cache cho chapter
   * @param {ObjectId} chapterId - Chapter ID
   */
  invalidateChapterCache(chapterId) {
    try {
      for (const [key] of this.cache.cache.entries()) {
        if (key.includes(`chapter:${chapterId}`)) {
          this.cache.delete(key);
        }
      }
    } catch (error) {
      console.error('Error invalidating chapter cache:', error);
    }
  }

  /**
   * Invalidate cache cho comment thread
   * @param {ObjectId} rootId - Root comment ID
   */
  invalidateThreadCache(rootId) {
    try {
      const key = this.generateThreadKey(rootId);
      this.cache.delete(key);
    } catch (error) {
      console.error('Error invalidating thread cache:', error);
    }
  }

  /**
   * Invalidate cache khi có comment mới
   * @param {Object} comment - Comment object
   */
  invalidateOnNewComment(comment) {
    try {
      // Invalidate story/chapter cache
      if (comment.target.story_id) {
        this.invalidateStoryCache(comment.target.story_id);
      }

      if (comment.target.chapter_id) {
        this.invalidateChapterCache(comment.target.chapter_id);
      }

      // Invalidate thread cache if it's a reply
      if (comment.hierarchy.root_id) {
        this.invalidateThreadCache(comment.hierarchy.root_id);
      }

      // Invalidate stats cache
      this.invalidateStatsCache();
    } catch (error) {
      console.error('Error invalidating cache on new comment:', error);
    }
  }

  /**
   * Invalidate cache khi comment được update
   * @param {Object} comment - Comment object
   */
  invalidateOnCommentUpdate(comment) {
    try {
      // Similar to new comment but also invalidate specific comment caches
      this.invalidateOnNewComment(comment);

      // Invalidate any cached individual comment data
      const commentKey = `comment:${comment._id}`;
      this.cache.delete(commentKey);
    } catch (error) {
      console.error('Error invalidating cache on comment update:', error);
    }
  }

  /**
   * Invalidate stats cache
   */
  invalidateStatsCache() {
    try {
      for (const [key] of this.cache.cache.entries()) {
        if (key.startsWith('stats:')) {
          this.cache.delete(key);
        }
      }
    } catch (error) {
      console.error('Error invalidating stats cache:', error);
    }
  }

  /**
   * Cache hot comments (trending, popular)
   * @param {String} type - 'trending' hoặc 'popular'
   * @param {Array} comments - Hot comments
   * @param {Number} ttl - TTL in seconds
   */
  cacheHotComments(type, comments, ttl = 1800) {
    try {
      const key = `hot:${type}`;
      this.cache.set(key, comments, ttl);
    } catch (error) {
      console.error('Error caching hot comments:', error);
    }
  }

  /**
   * Get cached hot comments
   * @param {String} type - 'trending' hoặc 'popular'
   * @returns {Array|null} - Cached hot comments or null
   */
  getCachedHotComments(type) {
    try {
      const key = `hot:${type}`;
      return this.cache.get(key);
    } catch (error) {
      console.error('Error getting cached hot comments:', error);
      return null;
    }
  }

  /**
   * Cache user's recent comments
   * @param {ObjectId} userId - User ID
   * @param {Array} comments - User's comments
   * @param {Number} ttl - TTL in seconds
   */
  cacheUserComments(userId, comments, ttl = 600) {
    try {
      const key = `user:${userId}:comments`;
      this.cache.set(key, comments, ttl);
    } catch (error) {
      console.error('Error caching user comments:', error);
    }
  }

  /**
   * Get cached user comments
   * @param {ObjectId} userId - User ID
   * @returns {Array|null} - Cached user comments or null
   */
  getCachedUserComments(userId) {
    try {
      const key = `user:${userId}:comments`;
      return this.cache.get(key);
    } catch (error) {
      console.error('Error getting cached user comments:', error);
      return null;
    }
  }

  /**
   * Clear all cache
   */
  clearAll() {
    try {
      this.cache.clear();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  getStats() {
    try {
      return {
        size: this.cache.cache.size,
        keys: Array.from(this.cache.cache.keys()).slice(0, 10), // First 10 keys
        memory_usage: process.memoryUsage()
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { size: 0, keys: [], memory_usage: {} };
    }
  }
}

module.exports = new CommentCacheService();
