const Story = require('../../models/story');
const Author = require('../../models/author');
const User = require('../../models/user');
const Chapter = require('../../models/chapter');

/**
 * Get stories pending approval
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getPendingStories = async (req, res) => {
  try {
    const { page = 1, limit = 20, approval_status = 'pending' } = req.query;

    console.log(`[Admin] Getting stories with approval status: ${approval_status}`);

    // Build query
    const query = {};
    if (['pending', 'approved', 'rejected'].includes(approval_status)) {
      query.approval_status = approval_status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get stories with pagination
    const [stories, totalCount] = await Promise.all([
      Story.find(query)
        .populate('author_id', 'name slug authorType userId')
        .populate('categories', 'name slug')
        .populate('approval_metadata.approved_by', 'name email')
        .sort({ 'approval_metadata.last_submitted_at': -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Story.countDocuments(query)
    ]);

    // Get chapter counts and author user info for each story
    const storiesWithDetails = await Promise.all(
      stories.map(async (story) => {
        // Get total chapter count
        const chapterCount = await Chapter.countDocuments({ story_id: story._id });

        // Get draft chapters count
        const draftChaptersCount = await Chapter.countDocuments({
          story_id: story._id,
          status: 'draft'
        });

        // Get user info for system authors
        let authorUser = null;
        if (story.author_id && story.author_id.length > 0) {
          const author = story.author_id[0];
          if (author.authorType === 'system' && author.userId) {
            authorUser = await User.findById(author.userId).select('name email').lean();
          }
        }

        return {
          ...story,
          chapterCount,
          draft_chapters_count: draftChaptersCount,
          authorUser
        };
      })
    );

    res.json({
      success: true,
      data: storiesWithDetails,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        total: totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('[Admin] Get pending stories error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách truyện chờ phê duyệt',
      error: error.message
    });
  }
};

/**
 * Approve or reject a story
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateStoryApproval = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const { storyId } = req.params;
    const { approval_status, rejection_reason } = req.body;

    console.log(`[Admin] Updating story approval: ${storyId} to ${approval_status} by admin: ${adminUserId}`);

    // Validate approval status
    if (!['approved', 'rejected'].includes(approval_status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái phê duyệt không hợp lệ'
      });
    }

    // Find story
    const story = await Story.findById(storyId)
      .populate('author_id', 'name userId authorType')
      .populate('approval_metadata.approved_by', 'name email');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại'
      });
    }

    // Check if story is in pending status
    if (story.approval_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể phê duyệt truyện đang chờ xét duyệt'
      });
    }

    // Validate rejection reason if rejecting
    if (approval_status === 'rejected' && (!rejection_reason || rejection_reason.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Lý do từ chối là bắt buộc khi từ chối truyện'
      });
    }

    // Update story approval status
    story.approval_status = approval_status;
    story.approval_metadata.approved_by = adminUserId;

    if (approval_status === 'approved') {
      story.approval_metadata.approved_at = new Date();
      story.approval_metadata.rejection_reason = '';
      story.approval_metadata.rejected_at = null;
    } else if (approval_status === 'rejected') {
      story.approval_metadata.rejection_reason = rejection_reason.trim();
      story.approval_metadata.rejected_at = new Date();
      story.approval_metadata.approved_at = null;
      // Ensure story is not published when rejected
      if (story.status === 'published') {
        story.status = 'draft';
      }
    }

    await story.save();

    // TODO: Send notification to author about approval/rejection
    // This would be implemented with a notification system

    res.json({
      success: true,
      message: approval_status === 'approved' ? 'Đã phê duyệt truyện thành công' : 'Đã từ chối truyện thành công',
      data: {
        storyId: story._id,
        approval_status: story.approval_status,
        approved_by: adminUserId,
        rejection_reason: story.approval_metadata.rejection_reason,
        approved_at: story.approval_metadata.approved_at,
        rejected_at: story.approval_metadata.rejected_at
      }
    });

  } catch (error) {
    console.error('[Admin] Update story approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật trạng thái phê duyệt',
      error: error.message
    });
  }
};

/**
 * Get story approval statistics
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getApprovalStats = async (req, res) => {
  try {
    console.log('[Admin] Getting story approval statistics');

    const [pendingCount, approvedCount, rejectedCount, totalCount] = await Promise.all([
      Story.countDocuments({ approval_status: 'pending' }),
      Story.countDocuments({ approval_status: 'approved' }),
      Story.countDocuments({ approval_status: 'rejected' }),
      Story.countDocuments({})
    ]);

    // Get recent approval activities
    const recentActivities = await Story.find({
      approval_status: { $in: ['approved', 'rejected'] }
    })
      .populate('author_id', 'name')
      .populate('approval_metadata.approved_by', 'name email')
      .sort({ 'approval_metadata.approved_at': -1, 'approval_metadata.rejected_at': -1 })
      .limit(10)
      .select('name approval_status approval_metadata')
      .lean();

    res.json({
      success: true,
      data: {
        stats: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          total: totalCount
        },
        recentActivities
      }
    });

  } catch (error) {
    console.error('[Admin] Get approval stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê phê duyệt',
      error: error.message
    });
  }
};
