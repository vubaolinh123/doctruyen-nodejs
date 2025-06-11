/**
 * Reported Comments Controller
 * Xử lý quản lý bình luận bị báo cáo
 */

const mongoose = require('mongoose');

class ReportedCommentsController {
  /**
   * Lấy danh sách bình luận bị báo cáo
   * @route GET /api/admin/comments/reported
   */
  async getReportedComments(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        status = 'all', // 'all', 'pending', 'resolved', 'dismissed', 'escalated'
        severity = 'all', // 'all', 'low', 'medium', 'high', 'critical'
        reason = 'all', // 'all', 'spam', 'inappropriate', etc.
        sort = 'newest',
        direction = 'desc',
        dateFrom,
        dateTo,
        type = 'all' // 'all', 'story', 'chapter'
      } = req.query;

      console.log('🔍 [getReportedComments] Request params:', {
        page, limit, search, status, severity, reason, sort, direction, dateFrom, dateTo, type
      });

      const Comment = require('../../models/comment');
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      // Build match stage
      const matchStage = {
        'moderation.flags.count': { $gt: 0 } // Only comments with reports
      };

      console.log('🔍 [getReportedComments] Match stage:', JSON.stringify(matchStage, null, 2));

      // Filter by resolution status
      if (status !== 'all') {
        matchStage['moderation.flags.resolution.status'] = status;
      }

      // Filter by comment type
      if (type !== 'all') {
        matchStage['target.type'] = type;
      }

      // Date range filter
      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) {
          matchStage.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          matchStage.createdAt.$lte = new Date(dateTo);
        }
      }

      // Build aggregation pipeline
      const pipeline = [
        { $match: matchStage },
        
        // Lookup user information
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $project: {
                  name: 1,
                  email: 1,
                  avatar: 1,
                  role: 1,
                  slug: 1
                }
              }
            ]
          }
        },
        {
          $addFields: {
            user: { $arrayElemAt: ['$user', 0] }
          }
        },

        // Lookup story information
        {
          $lookup: {
            from: 'stories',
            localField: 'target.story_id',
            foreignField: '_id',
            as: 'story',
            pipeline: [
              {
                $project: {
                  name: 1,
                  slug: 1,
                  cover: 1
                }
              }
            ]
          }
        },
        {
          $addFields: {
            story: { $arrayElemAt: ['$story', 0] }
          }
        },

        // Lookup chapter information (if applicable)
        {
          $lookup: {
            from: 'chapters',
            localField: 'target.chapter_id',
            foreignField: '_id',
            as: 'chapter',
            pipeline: [
              {
                $project: {
                  name: 1,
                  chapter: 1
                }
              }
            ]
          }
        },

        // Add computed fields
        {
          $addFields: {
            chapter: { $arrayElemAt: ['$chapter', 0] },
            // Get highest severity from all reports
            highestSeverity: {
              $reduce: {
                input: '$moderation.flags.flagged_by',
                initialValue: 'low',
                in: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$$this.severity', 'critical'] }, then: 'critical' },
                      { case: { $and: [{ $eq: ['$$value', 'low'] }, { $eq: ['$$this.severity', 'high'] }] }, then: 'high' },
                      { case: { $and: [{ $in: ['$$value', ['low', 'medium']] }, { $eq: ['$$this.severity', 'medium'] }] }, then: 'medium' }
                    ],
                    default: '$$value'
                  }
                }
              }
            },
            // Get most recent report date
            latestReportDate: {
              $max: '$moderation.flags.flagged_by.flagged_at'
            }
          }
        }
      ];

      // Add severity filter after computed fields
      if (severity !== 'all') {
        pipeline.push({
          $match: { highestSeverity: severity }
        });
      }

      // Add reason filter
      if (reason !== 'all') {
        pipeline.push({
          $match: { 'moderation.flags.flagged_by.reason': reason }
        });
      }

      // Add search filter
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { 'content.original': { $regex: search, $options: 'i' } },
              { 'user.name': { $regex: search, $options: 'i' } },
              { 'story.name': { $regex: search, $options: 'i' } }
            ]
          }
        });
      }

      // Add sorting
      const sortField = sort === 'newest' ? 'latestReportDate' :
                       sort === 'oldest' ? 'latestReportDate' :
                       sort === 'severity' ? 'highestSeverity' :
                       sort === 'reports' ? 'moderation.flags.count' : 'latestReportDate';
      
      const sortDirection = direction === 'asc' ? 1 : -1;
      
      pipeline.push({
        $sort: { [sortField]: sortDirection }
      });

      // Get total count
      const countPipeline = [...pipeline, { $count: 'total' }];
      const totalResult = await Comment.aggregate(countPipeline);
      const totalItems = totalResult[0]?.total || 0;

      // Add pagination
      pipeline.push(
        { $skip: skip },
        { $limit: limitNumber }
      );

      console.log('🚀 [getReportedComments] Executing aggregation pipeline...');
      const comments = await Comment.aggregate(pipeline);

      console.log(`✅ [getReportedComments] Found ${comments.length} reported comments`);

      // Debug: Log first comment structure
      if (comments.length > 0) {
        console.log('🔍 [getReportedComments] Sample comment structure:', {
          _id: comments[0]._id,
          user: comments[0].user ? {
            _id: comments[0].user._id,
            name: comments[0].user.name,
            email: comments[0].user.email
          } : 'NO USER',
          story: comments[0].story ? {
            _id: comments[0].story._id,
            name: comments[0].story.name
          } : 'NO STORY',
          content: comments[0].content?.original?.substring(0, 50) + '...',
          moderation: {
            flags: {
              count: comments[0].moderation?.flags?.count,
              resolution: comments[0].moderation?.flags?.resolution?.status
            }
          }
        });
      }

      // Calculate pagination info
      const totalPages = Math.ceil(totalItems / limitNumber);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      const response = {
        success: true,
        data: comments,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          itemsPerPage: limitNumber,
          hasNextPage,
          hasPrevPage
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error getting reported comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách bình luận bị báo cáo'
      });
    }
  }

  /**
   * Lấy thống kê bình luận bị báo cáo
   * @route GET /api/admin/comments/reported/stats
   */
  async getReportedStats(req, res) {
    try {
      const { timeRange = '7d' } = req.query;

      console.log('🔍 [getReportedStats] Request params:', { timeRange });

      const Comment = require('../../models/comment');
      
      // Calculate date range
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const pipeline = [
        {
          $match: {
            'moderation.flags.count': { $gt: 0 },
            'moderation.flags.flagged_by.flagged_at': { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalReported: { $sum: 1 },
            totalReports: { $sum: '$moderation.flags.count' },
            pendingReports: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.flags.resolution.status', 'pending'] },
                  1,
                  0
                ]
              }
            },
            resolvedReports: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.flags.resolution.status', 'resolved'] },
                  1,
                  0
                ]
              }
            },
            dismissedReports: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.flags.resolution.status', 'dismissed'] },
                  1,
                  0
                ]
              }
            },
            escalatedReports: {
              $sum: {
                $cond: [
                  { $eq: ['$moderation.flags.resolution.status', 'escalated'] },
                  1,
                  0
                ]
              }
            },
            criticalReports: {
              $sum: {
                $cond: [
                  { $in: ['critical', '$moderation.flags.flagged_by.severity'] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ];

      const statsResult = await Comment.aggregate(pipeline);
      const stats = statsResult[0] || {
        totalReported: 0,
        totalReports: 0,
        pendingReports: 0,
        resolvedReports: 0,
        dismissedReports: 0,
        escalatedReports: 0,
        criticalReports: 0
      };

      // Get reason breakdown
      const reasonPipeline = [
        {
          $match: {
            'moderation.flags.count': { $gt: 0 },
            'moderation.flags.flagged_by.flagged_at': { $gte: startDate }
          }
        },
        { $unwind: '$moderation.flags.flagged_by' },
        {
          $group: {
            _id: '$moderation.flags.flagged_by.reason',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ];

      const reasonStats = await Comment.aggregate(reasonPipeline);

      const response = {
        success: true,
        data: {
          overview: stats,
          reasonBreakdown: reasonStats,
          timeRange,
          generatedAt: new Date()
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error getting reported stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy thống kê bình luận bị báo cáo'
      });
    }
  }

  /**
   * Giải quyết báo cáo bình luận
   * @route POST /api/admin/comments/reported/:commentId/resolve
   */
  async resolveReport(req, res) {
    try {
      const { commentId } = req.params;
      const {
        action = 'none', // 'none', 'warning', 'content-hidden', 'content-deleted', 'user-suspended', 'user-banned'
        reason = '',
        adminNotes = ''
      } = req.body;

      console.log('🔍 [resolveReport] Request params:', {
        commentId, action, reason, adminNotes
      });

      // Validate commentId
      if (!commentId || !commentId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'ID bình luận không hợp lệ'
        });
      }

      const Comment = require('../../models/comment');

      // Find comment
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bình luận'
        });
      }

      // Check if comment has reports
      if (!comment.moderation?.flags?.count || comment.moderation.flags.count === 0) {
        return res.status(400).json({
          success: false,
          message: 'Bình luận này không có báo cáo nào'
        });
      }

      // Update resolution
      const updateData = {
        'moderation.flags.resolution.status': 'resolved',
        'moderation.flags.resolution.resolved_by': req.user.id,
        'moderation.flags.resolution.resolved_at': new Date(),
        'moderation.flags.resolution.resolution_reason': reason,
        'moderation.flags.resolution.admin_notes': adminNotes,
        'moderation.flags.resolution.action_taken': action
      };

      // Apply action based on type
      if (action === 'content-hidden') {
        updateData['moderation.status'] = 'hidden';
      } else if (action === 'content-deleted') {
        updateData['moderation.status'] = 'deleted';
      }

      const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        updateData,
        { new: true }
      ).populate('user_id', 'name email avatar role slug');

      console.log('✅ [resolveReport] Report resolved successfully');

      res.json({
        success: true,
        message: 'Báo cáo đã được giải quyết thành công',
        data: updatedComment
      });

    } catch (error) {
      console.error('Error resolving report:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi giải quyết báo cáo'
      });
    }
  }

  /**
   * Bỏ qua báo cáo (dismiss)
   * @route DELETE /api/admin/comments/reported/:commentId/dismiss
   */
  async dismissReport(req, res) {
    try {
      const { commentId } = req.params;
      const { reason = '' } = req.body;

      console.log('🔍 [dismissReport] Request params:', { commentId, reason });

      // Validate commentId
      if (!commentId || !commentId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'ID bình luận không hợp lệ'
        });
      }

      const Comment = require('../../models/comment');

      // Update resolution to dismissed
      const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
          'moderation.flags.resolution.status': 'dismissed',
          'moderation.flags.resolution.resolved_by': req.user.id,
          'moderation.flags.resolution.resolved_at': new Date(),
          'moderation.flags.resolution.resolution_reason': reason,
          'moderation.flags.resolution.action_taken': 'none'
        },
        { new: true }
      );

      if (!updatedComment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bình luận'
        });
      }

      console.log('✅ [dismissReport] Report dismissed successfully');

      res.json({
        success: true,
        message: 'Báo cáo đã được bỏ qua',
        data: updatedComment
      });

    } catch (error) {
      console.error('Error dismissing report:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi bỏ qua báo cáo'
      });
    }
  }



  /**
   * Xử lý hàng loạt báo cáo
   * @route POST /api/admin/comments/reported/bulk-action
   */
  async bulkAction(req, res) {
    try {
      const {
        commentIds = [],
        action = 'resolve', // 'resolve', 'dismiss'
        actionType = 'none', // For resolve action
        reason = ''
      } = req.body;

      console.log('🔍 [bulkAction] Request params:', {
        commentIds: commentIds.length,
        action,
        actionType,
        reason
      });

      if (!Array.isArray(commentIds) || commentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách ID bình luận không hợp lệ'
        });
      }

      const Comment = require('../../models/comment');

      let updateData = {};

      switch (action) {
        case 'resolve':
          updateData = {
            'moderation.flags.resolution.status': 'resolved',
            'moderation.flags.resolution.resolved_by': req.user.id,
            'moderation.flags.resolution.resolved_at': new Date(),
            'moderation.flags.resolution.resolution_reason': reason,
            'moderation.flags.resolution.action_taken': actionType
          };

          if (actionType === 'content-hidden') {
            updateData['moderation.status'] = 'hidden';
          } else if (actionType === 'content-deleted') {
            updateData['moderation.status'] = 'deleted';
          }
          break;

        case 'dismiss':
          updateData = {
            'moderation.flags.resolution.status': 'dismissed',
            'moderation.flags.resolution.resolved_by': req.user.id,
            'moderation.flags.resolution.resolved_at': new Date(),
            'moderation.flags.resolution.resolution_reason': reason,
            'moderation.flags.resolution.action_taken': 'none'
          };
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Hành động không hợp lệ'
          });
      }

      const result = await Comment.updateMany(
        {
          _id: { $in: commentIds.map(id => new mongoose.Types.ObjectId(id)) },
          'moderation.flags.count': { $gt: 0 }
        },
        updateData
      );

      console.log('✅ [bulkAction] Bulk action completed:', result);

      res.json({
        success: true,
        message: `Đã xử lý ${result.modifiedCount} báo cáo thành công`,
        data: {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount
        }
      });

    } catch (error) {
      console.error('Error performing bulk action:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi xử lý hàng loạt báo cáo'
      });
    }
  }

  /**
   * Test endpoint để tạo sample reported comment
   * @route POST /api/admin/comments/reported/create-sample
   */
  async createSampleReport(req, res) {
    try {
      const Comment = require('../../models/comment');

      // Find a random comment to add report to
      const randomComment = await Comment.findOne({
        'moderation.flags.count': { $exists: false }
      }).limit(1);

      if (!randomComment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy comment nào để tạo sample'
        });
      }

      // Add sample report
      const updatedComment = await Comment.findByIdAndUpdate(
        randomComment._id,
        {
          $set: {
            'moderation.flags.count': 1,
            'moderation.flags.reasons': ['inappropriate'],
            'moderation.flags.flagged_by': [{
              user_id: new mongoose.Types.ObjectId(),
              reason: 'inappropriate',
              severity: 'medium',
              flagged_at: new Date(),
              additional_context: 'Sample report for testing'
            }],
            'moderation.flags.resolution.status': 'pending'
          }
        },
        { new: true }
      );

      console.log('✅ [createSampleReport] Sample report created:', updatedComment._id);

      res.json({
        success: true,
        message: 'Sample report created successfully',
        data: updatedComment
      });

    } catch (error) {
      console.error('Error creating sample report:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi tạo sample report'
      });
    }
  }
}

module.exports = new ReportedCommentsController();
