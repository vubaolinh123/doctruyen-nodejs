const rateLimit = require('express-rate-limit');
// const MongoStore = require('rate-limit-mongo'); // Optional - use memory store for now

/**
 * Rate limiting middleware cho comment system
 * Ngăn chặn spam và abuse
 */

// Basic rate limit cho tất cả comment operations
const commentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + user ID if authenticated
    // Handle both _id and id fields with proper null checks
    const userId = req.user ? (req.user._id || req.user.id) : null;
    return userId ? `${req.ip}-${userId.toString()}` : req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for admins
    return req.user && req.user.role === 'admin';
  }
});

// Strict rate limit cho việc tạo comment mới
const createCommentRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit to 5 comments per minute per user
  message: {
    success: false,
    message: 'Bạn đang bình luận quá nhanh, vui lòng chờ 1 phút'
  },
  keyGenerator: (req) => {
    try {
      if (!req.user) {
        return req.ip;
      }

      const userId = req.user._id || req.user.id;
      if (!userId) {
        return req.ip;
      }

      return userId.toString();
    } catch (error) {
      console.error('[Create Comment Rate Limit] Error in keyGenerator:', error);
      return req.ip;
    }
  },
  skip: (req) => {
    // Skip rate limiting for admins
    return req.user && req.user.role === 'admin';
  }
});

// Rate limit cho like/dislike operations
const likeRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit to 30 likes per minute per user
  message: {
    success: false,
    message: 'Bạn đang thích/không thích quá nhanh, vui lòng chờ'
  },
  keyGenerator: (req) => {
    try {
      // Handle both _id and id fields with proper null checks
      const userId = req.user ? (req.user._id || req.user.id) : null;
      const key = userId ? userId.toString() : req.ip;

      // Debug logging for troubleshooting
      if (process.env.NODE_ENV === 'development') {
        console.log('[Like Rate Limit] Key generated:', {
          hasUser: !!req.user,
          userId: userId,
          key: key,
          ip: req.ip
        });
      }

      return key;
    } catch (error) {
      console.error('[Like Rate Limit] Error generating key:', error);
      // Fallback to IP if user data is corrupted
      return req.ip;
    }
  },
  skip: (req) => {
    // Skip rate limiting for admins
    return req.user && req.user.role === 'admin';
  }
});

// Rate limit cho flag operations
const flagRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit to 10 flags per 5 minutes per user
  message: {
    success: false,
    message: 'Bạn đang báo cáo quá nhiều, vui lòng chờ 5 phút'
  },
  keyGenerator: (req) => {
    // Handle both _id and id fields with proper null checks
    const userId = req.user ? (req.user._id || req.user.id) : null;
    return userId ? userId.toString() : req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for admins
    return req.user && req.user.role === 'admin';
  }
});

/**
 * Advanced spam detection middleware
 */
const spamDetection = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    // Skip spam detection for admins
    if (req.user.role === 'admin') {
      console.log('[Spam Detection] Bypassing spam detection for admin user:', req.user._id || req.user.id);
      return next();
    }

    const userId = req.user._id || req.user.id;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check for rapid commenting pattern
    const Comment = require('../models/comment');
    const recentComments = await Comment.countDocuments({
      user_id: userId,
      createdAt: { $gte: oneHourAgo }
    });

    // If user has made more than 20 comments in the last hour
    if (recentComments >= 20) {
      return res.status(429).json({
        success: false,
        message: 'Hoạt động bình luận bất thường được phát hiện. Tài khoản tạm thời bị hạn chế.'
      });
    }

    // Check for duplicate content
    if (req.body.content) {
      const duplicateComment = await Comment.findOne({
        user_id: userId,
        'content.original': req.body.content,
        createdAt: { $gte: new Date(now.getTime() - 5 * 60 * 1000) } // Last 5 minutes
      });

      if (duplicateComment) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã bình luận nội dung tương tự gần đây'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Spam detection error:', error);
    next(); // Don't block on error
  }
};

/**
 * Content length validation
 */
const contentValidation = (req, res, next) => {
  if (req.body.content) {
    const content = req.body.content.trim();

    if (content.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung bình luận không được để trống'
      });
    }

    if (content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung bình luận quá dài (tối đa 2000 ký tự)'
      });
    }

    // Check for excessive caps
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.7 && content.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng không viết toàn bộ chữ in hoa'
      });
    }

    // Check for excessive special characters
    const specialCharsRatio = (content.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length / content.length;
    if (specialCharsRatio > 0.5) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung chứa quá nhiều ký tự đặc biệt'
      });
    }
  }

  next();
};

/**
 * IP-based suspicious activity detection
 */
const ipSuspiciousActivityDetection = async (req, res, next) => {
  try {
    // Skip IP detection for admins
    if (req.user && req.user.role === 'admin') {
      console.log('[IP Detection] Bypassing IP detection for admin user:', req.user._id || req.user.id);
      return next();
    }

    const ip = req.ip;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check Redis for IP activity (if Redis is available)
    // For now, use MongoDB
    const Comment = require('../models/comment');

    // Count comments from this IP in the last hour
    const ipComments = await Comment.countDocuments({
      'metadata.ip_hash': require('crypto')
        .createHash('sha256')
        .update(ip + (process.env.HASH_SALT || 'default_salt'))
        .digest('hex'),
      createdAt: { $gte: oneHourAgo }
    });

    // If more than 30 comments from same IP in 1 hour
    if (ipComments >= 30) {
      return res.status(429).json({
        success: false,
        message: 'Quá nhiều hoạt động từ địa chỉ IP này'
      });
    }

    next();
  } catch (error) {
    console.error('IP suspicious activity detection error:', error);
    next(); // Don't block on error
  }
};

/**
 * User permission check
 */
const checkCommentPermission = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để bình luận'
      });
    }

    // Check if user is banned from commenting
    if (req.user.permissions && req.user.permissions.comment_banned) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị cấm bình luận'
      });
    }

    // Check user level restrictions
    if (req.user.level < 1) {
      return res.status(403).json({
        success: false,
        message: 'Bạn cần đạt level 1 để có thể bình luận'
      });
    }

    next();
  } catch (error) {
    console.error('Comment permission check error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra quyền bình luận'
    });
  }
};

module.exports = {
  commentRateLimit,
  createCommentRateLimit,
  likeRateLimit,
  flagRateLimit,
  spamDetection,
  contentValidation,
  ipSuspiciousActivityDetection,
  checkCommentPermission
};
