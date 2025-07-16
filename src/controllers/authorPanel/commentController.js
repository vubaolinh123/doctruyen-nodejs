const mongoose = require('mongoose');
const Author = require('../../models/Author');
const Story = require('../../models/Story');
const Chapter = require('../../models/Chapter');
const Comment = require('../../models/Comment');
const User = require('../../models/User');

// Helper function to get date range
const getDateRange = (timeRange) => {
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
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate: now };
};

// Get all comments for author's stories
exports.getAuthorComments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status = 'all',
      storyId = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      timeRange = 'all'
    } = req.query;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let storyFilter = {};

    if (!isAdmin) {
      // Find author record for regular users
      author = await Author.findOne({
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

      storyFilter = { author_id: author._id };
    }

    // Build match conditions
    let matchConditions = {};

    // Time range filter
    if (timeRange !== 'all') {
      const { startDate } = getDateRange(timeRange);
      matchConditions.createdAt = { $gte: startDate };
    }

    // Search filter
    if (search) {
      matchConditions.$or = [
        { content: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status !== 'all') {
      matchConditions.status = status;
    }

    // Story filter
    if (storyId) {
      matchConditions.story_id = new mongoose.Types.ObjectId(storyId);
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
        $lookup: {
          from: 'chapters',
          localField: 'chapter_id',
          foreignField: '_id',
          as: 'chapter'
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
        $match: {
          'story.0': { $exists: true },
          ...(isAdmin ? {} : { 'story.author_id': author._id }),
          ...matchConditions
        }
      },
      {
        $addFields: {
          story: { $arrayElemAt: ['$story', 0] },
          chapter: { $arrayElemAt: ['$chapter', 0] },
          user: { $arrayElemAt: ['$user', 0] }
        }
      },
      {
        $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
      }
    ];

    // Get comments with pagination
    const [comments, totalComments] = await Promise.all([
      Comment.aggregate([
        ...pipeline,
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ]),
      Comment.aggregate([
        ...pipeline,
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0)
    ]);

    // Get comment statistics
    const stats = await Comment.aggregate([
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
          'story.0': { $exists: true },
          ...(isAdmin ? {} : { 'story.author_id': author._id })
        }
      },
      {
        $group: {
          _id: null,
          totalComments: { $sum: 1 },
          pendingComments: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          approvedComments: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          hiddenComments: {
            $sum: { $cond: [{ $eq: ['$status', 'hidden'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        comments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalComments,
          totalPages: Math.ceil(totalComments / parseInt(limit))
        },
        statistics: stats[0] || {
          totalComments: 0,
          pendingComments: 0,
          approvedComments: 0,
          hiddenComments: 0
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tải danh sách bình luận'
    });
  }
};

// Update comment status (approve, hide, delete)
exports.updateCommentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentId } = req.params;
    const { status, action } = req.body;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;

    if (!isAdmin) {
      // Find author record for regular users
      author = await Author.findOne({
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
    }

    // Find comment and verify ownership
    const comment = await Comment.findById(commentId)
      .populate('story_id', 'author_id name slug');

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Bình luận không tồn tại'
      });
    }

    // Check if author owns the story (unless admin)
    if (!isAdmin && comment.story_id.author_id.toString() !== author._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thao tác với bình luận này'
      });
    }

    // Handle different actions
    if (action === 'delete') {
      await Comment.findByIdAndDelete(commentId);
    } else {
      // Update status
      comment.status = status;
      comment.moderatedAt = new Date();
      comment.moderatedBy = userId;
      await comment.save();
    }

    res.json({
      success: true,
      message: action === 'delete' ? 'Đã xóa bình luận' : 'Đã cập nhật trạng thái bình luận'
    });

  } catch (error) {
    console.error('[AuthorPanel] Update comment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật bình luận'
    });
  }
};

// Bulk update comments
exports.bulkUpdateComments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { commentIds, action, status } = req.body;

    // Check if user is admin
    const isAdmin = req.user.role === 'admin';

    let author = null;

    if (!isAdmin) {
      // Find author record for regular users
      author = await Author.findOne({
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
    }

    // Find comments and verify ownership
    const comments = await Comment.find({
      _id: { $in: commentIds }
    }).populate('story_id', 'author_id');

    // Filter comments that belong to the author (unless admin)
    const authorizedComments = isAdmin ? comments : comments.filter(
      comment => comment.story_id.author_id.toString() === author._id.toString()
    );

    if (authorizedComments.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Không có bình luận nào thuộc quyền quản lý của bạn'
      });
    }

    const authorizedIds = authorizedComments.map(comment => comment._id);

    // Perform bulk action
    if (action === 'delete') {
      await Comment.deleteMany({ _id: { $in: authorizedIds } });
    } else {
      await Comment.updateMany(
        { _id: { $in: authorizedIds } },
        {
          status: status,
          moderatedAt: new Date(),
          moderatedBy: userId
        }
      );
    }

    res.json({
      success: true,
      message: `Đã ${action === 'delete' ? 'xóa' : 'cập nhật'} ${authorizedIds.length} bình luận`,
      processedCount: authorizedIds.length
    });

  } catch (error) {
    console.error('[AuthorPanel] Bulk update comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật hàng loạt bình luận'
    });
  }
};
