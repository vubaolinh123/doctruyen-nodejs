const Comment = require('../../models/comment');
const Story = require('../../models/story');
const Author = require('../../models/author');
const UserRating = require('../../models/userRating');
const StoriesReading = require('../../models/storiesReading');
const User = require('../../models/user');
const mongoose = require('mongoose');

/**
 * Get comments on author's stories
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getStoryComments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20,
      storyId = '',
      status = 'all',
      sort = '-createdAt'
    } = req.query;

    // Find author record
    const author = await Author.findOne({ 
      userId: userId, 
      authorType: 'system',
      approvalStatus: 'approved'
    });

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại'
      });
    }

    // Build aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: 'stories',
          localField: 'story_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      {
        $match: {
          'story.author_id': author._id
        }
      }
    ];

    // Add story filter if specified
    if (storyId) {
      pipeline.push({
        $match: {
          story_id: new mongoose.Types.ObjectId(storyId)
        }
      });
    }

    // Add status filter if specified
    if (status !== 'all') {
      pipeline.push({
        $match: {
          status: status
        }
      });
    }

    // Add user lookup
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: '_id',
        as: 'user'
      }
    });

    // Add sorting
    const sortObj = {};
    if (sort.startsWith('-')) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }
    pipeline.push({ $sort: sortObj });

    // Add pagination
    pipeline.push(
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    // Project fields
    pipeline.push({
      $project: {
        content: 1,
        createdAt: 1,
        updatedAt: 1,
        status: 1,
        likes: 1,
        'story.name': 1,
        'story.slug': 1,
        'user.name': 1,
        'user.avatar': 1
      }
    });

    // Execute aggregation
    const [comments, totalComments] = await Promise.all([
      Comment.aggregate(pipeline),
      Comment.aggregate([
        ...pipeline.slice(0, -3), // Remove pagination and projection
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0)
    ]);

    const totalPages = Math.ceil(totalComments / parseInt(limit));

    res.json({
      success: true,
      data: {
        comments,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalComments,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get story comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy bình luận',
      error: error.message
    });
  }
};

/**
 * Reply to comment
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.replyToComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung phản hồi không được để trống'
      });
    }

    // Find author record
    const author = await Author.findOne({ 
      userId: userId, 
      authorType: 'system',
      approvalStatus: 'approved'
    });

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại'
      });
    }

    // Get original comment and verify it's on author's story
    const originalComment = await Comment.findById(commentId)
      .populate({
        path: 'story_id',
        select: 'author_id name',
        match: { author_id: author._id }
      });

    if (!originalComment || !originalComment.story_id) {
      return res.status(404).json({
        success: false,
        message: 'Bình luận không tồn tại hoặc không thuộc truyện của bạn'
      });
    }

    // Create reply comment
    const replyComment = new Comment({
      user_id: userId,
      story_id: originalComment.story_id._id,
      chapter_id: originalComment.chapter_id,
      content: content.trim(),
      parent_id: commentId,
      status: 'approved' // Author replies are auto-approved
    });

    await replyComment.save();

    // Populate user info for response
    await replyComment.populate('user_id', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'Phản hồi bình luận thành công',
      data: replyComment
    });

  } catch (error) {
    console.error('[AuthorPanel] Reply to comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi phản hồi bình luận',
      error: error.message
    });
  }
};

/**
 * Get story ratings and reviews
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getStoryRatings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20,
      storyId = '',
      rating = 'all',
      sort = '-createdAt'
    } = req.query;

    // Find author record
    const author = await Author.findOne({ 
      userId: userId, 
      authorType: 'system',
      approvalStatus: 'approved'
    });

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại'
      });
    }

    // Build aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: 'stories',
          localField: 'story_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      {
        $match: {
          'story.author_id': author._id
        }
      }
    ];

    // Add story filter if specified
    if (storyId) {
      pipeline.push({
        $match: {
          story_id: new mongoose.Types.ObjectId(storyId)
        }
      });
    }

    // Add rating filter if specified
    if (rating !== 'all') {
      pipeline.push({
        $match: {
          rating: parseInt(rating)
        }
      });
    }

    // Add user lookup
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: '_id',
        as: 'user'
      }
    });

    // Add sorting
    const sortObj = {};
    if (sort.startsWith('-')) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }
    pipeline.push({ $sort: sortObj });

    // Get total count before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];

    // Add pagination
    pipeline.push(
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    // Project fields
    pipeline.push({
      $project: {
        rating: 1,
        review: 1,
        createdAt: 1,
        'story.name': 1,
        'story.slug': 1,
        'user.name': 1,
        'user.avatar': 1
      }
    });

    // Execute aggregation
    const [ratings, totalRatings] = await Promise.all([
      UserRating.aggregate(pipeline),
      UserRating.aggregate(countPipeline).then(result => result[0]?.total || 0)
    ]);

    // Get rating distribution
    const ratingDistribution = await UserRating.aggregate([
      {
        $lookup: {
          from: 'stories',
          localField: 'story_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      {
        $match: {
          'story.author_id': author._id
        }
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    const totalPages = Math.ceil(totalRatings / parseInt(limit));

    res.json({
      success: true,
      data: {
        ratings,
        ratingDistribution,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalRatings,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get story ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy đánh giá truyện',
      error: error.message
    });
  }
};

/**
 * Get reader feedback and suggestions
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getReaderFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      type = 'all' // 'comments', 'ratings', 'all'
    } = req.query;

    // Find author record
    const author = await Author.findOne({
      userId: userId,
      authorType: 'system',
      approvalStatus: 'approved'
    });

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại'
      });
    }

    let feedback = [];

    if (type === 'all' || type === 'comments') {
      // Get recent comments with content
      const comments = await Comment.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            'story.author_id': author._id,
            content: { $ne: '' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $limit: type === 'comments' ? parseInt(limit) : Math.floor(parseInt(limit) / 2)
        },
        {
          $project: {
            type: { $literal: 'comment' },
            content: 1,
            createdAt: 1,
            'story.name': 1,
            'story.slug': 1,
            'user.name': 1,
            'user.avatar': 1
          }
        }
      ]);

      feedback = feedback.concat(comments);
    }

    if (type === 'all' || type === 'ratings') {
      // Get recent ratings with reviews
      const ratings = await UserRating.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            'story.author_id': author._id,
            review: { $ne: '', $exists: true }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $limit: type === 'ratings' ? parseInt(limit) : Math.floor(parseInt(limit) / 2)
        },
        {
          $project: {
            type: { $literal: 'rating' },
            content: '$review',
            rating: 1,
            createdAt: 1,
            'story.name': 1,
            'story.slug': 1,
            'user.name': 1,
            'user.avatar': 1
          }
        }
      ]);

      feedback = feedback.concat(ratings);
    }

    // Sort combined feedback by date
    feedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination to combined results
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedFeedback = feedback.slice(startIndex, startIndex + parseInt(limit));

    const totalPages = Math.ceil(feedback.length / parseInt(limit));

    res.json({
      success: true,
      data: {
        feedback: paginatedFeedback,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: feedback.length,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get reader feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy phản hồi độc giả',
      error: error.message
    });
  }
};

/**
 * Get follower/subscriber information
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getFollowers = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      timeRange = '30d'
    } = req.query;

    // Find author record
    const author = await Author.findOne({
      userId: userId,
      authorType: 'system',
      approvalStatus: 'approved'
    });

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại'
      });
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get readers who have reading history with author's stories
    const [readers, totalReaders] = await Promise.all([
      StoriesReading.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            'story.author_id': author._id
          }
        },
        {
          $group: {
            _id: '$user_id',
            storiesRead: { $addToSet: '$story_id' },
            lastActivity: { $max: '$updatedAt' },
            totalChaptersRead: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $match: {
            'user.0': { $exists: true }
          }
        },
        {
          $sort: { lastActivity: -1 }
        },
        {
          $skip: (parseInt(page) - 1) * parseInt(limit)
        },
        {
          $limit: parseInt(limit)
        },
        {
          $project: {
            userId: '$_id',
            storiesReadCount: { $size: '$storiesRead' },
            totalChaptersRead: 1,
            lastActivity: 1,
            'user.name': 1,
            'user.avatar': 1,
            'user.createdAt': 1
          }
        }
      ]),

      StoriesReading.aggregate([
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        {
          $match: {
            'story.author_id': author._id
          }
        },
        {
          $group: {
            _id: '$user_id'
          }
        },
        {
          $count: 'total'
        }
      ]).then(result => result[0]?.total || 0)
    ]);

    // Get new followers in time range
    const newFollowers = await StoriesReading.aggregate([
      {
        $lookup: {
          from: 'stories',
          localField: 'story_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      {
        $match: {
          'story.author_id': author._id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$user_id'
        }
      },
      {
        $count: 'total'
      }
    ]).then(result => result[0]?.total || 0);

    const totalPages = Math.ceil(totalReaders / parseInt(limit));

    res.json({
      success: true,
      data: {
        followers: {
          total: totalReaders,
          new: newFollowers,
          list: readers
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalReaders,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        timeRange
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get followers error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin người theo dõi',
      error: error.message
    });
  }
};
