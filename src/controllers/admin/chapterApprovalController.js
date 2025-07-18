const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const User = require('../../models/user');
const Author = require('../../models/author');
const { isAdminRole } = require('../../utils/authUtils');

/**
 * Get stories with pending draft chapters for approval
 * Only returns stories that have chapters with status: 'draft' AND approval_status: 'pending'
 */
exports.getStoriesWithPendingChapters = async (req, res) => {
  try {
    console.log('[Admin] Getting stories with pending draft chapters');

    // Verify admin role
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền truy cập'
      });
    }

    const {
      page = 1,
      limit = 20,
      search = '',
      sort = '-updatedAt',
      category = '',
      author = '',
      dateRange = ''
    } = req.query;

    console.log('[Admin] Chapter approval query params:', {
      page, limit, search, sort, category, author, dateRange
    });

    // First, find all chapters that are draft and pending approval
    // Include both 'pending' and 'not_submitted' as they both need approval
    const pendingChapterQuery = {
      status: 'draft',
      approval_status: { $in: ['pending', 'not_submitted'] }
    };

    // Get unique story IDs that have pending draft chapters
    // Use aggregation instead of distinct to avoid API version issues
    const storiesWithPendingChapters = await Chapter.aggregate([
      { $match: pendingChapterQuery },
      { $group: { _id: '$story_id' } },
      { $project: { _id: 1 } }
    ]).then(results => results.map(r => r._id));
    
    if (storiesWithPendingChapters.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          total: 0,
          limit: parseInt(limit)
        }
      });
    }

    console.log(`[Admin] Found ${storiesWithPendingChapters.length} stories with pending chapters`);

    // Build story query
    const storyQuery = {
      _id: { $in: storiesWithPendingChapters }
    };

    // Add search filter
    if (search) {
      storyQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { desc: { $regex: search, $options: 'i' } }
      ];
    }

    // Add category filter
    if (category) {
      storyQuery.categories = category;
    }

    // Add author filter
    if (author) {
      storyQuery.author_id = author;
    }

    // Add date range filter
    if (dateRange) {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case '3months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
      }
      
      if (startDate) {
        storyQuery.updatedAt = { $gte: startDate };
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get stories with pagination
    const [stories, totalCount] = await Promise.all([
      Story.find(storyQuery)
        .populate('author_id', 'name slug authorType userId')
        .populate('categories', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Story.countDocuments(storyQuery)
    ]);

    // Get chapter counts and author user info for each story
    const storiesWithDetails = await Promise.all(
      stories.map(async (story) => {
        // Get total chapter count
        const chapterCount = await Chapter.countDocuments({ story_id: story._id });
        
        // Get pending draft chapters count
        const pendingChaptersCount = await Chapter.countDocuments({
          story_id: story._id,
          status: 'draft',
          approval_status: { $in: ['pending', 'not_submitted'] }
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
          pending_chapters_count: pendingChaptersCount,
          authorUser
        };
      })
    );

    // Filter out stories with 0 pending chapters (in case they were updated during processing)
    const filteredStories = storiesWithDetails.filter(story => story.pending_chapters_count > 0);

    res.json({
      success: true,
      data: filteredStories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        total: totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('[Admin] Get stories with pending chapters error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách truyện có chapter chờ duyệt',
      error: error.message
    });
  }
};

/**
 * Get pending chapters for a specific story
 */
exports.getPendingChaptersByStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const {
      page = 1,
      limit = 50,
      sort = 'chapter'
    } = req.query;

    console.log(`[Admin] Getting pending chapters for story: ${storyId}`);

    // Verify admin role
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền truy cập'
      });
    }

    // Build query for pending draft chapters
    const query = {
      story_id: storyId,
      status: 'draft',
      approval_status: { $in: ['pending', 'not_submitted'] }
    };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get chapters with pagination
    const [chapters, totalCount] = await Promise.all([
      Chapter.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Chapter.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: chapters,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        total: totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('[Admin] Get pending chapters by story error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách chapter chờ duyệt',
      error: error.message
    });
  }
};

/**
 * Approve or reject a chapter
 */
exports.updateChapterApproval = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { approval_status, rejection_reason } = req.body;

    console.log(`[Admin] Updating chapter approval: ${chapterId} to ${approval_status}`);

    // Verify admin role
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền thực hiện thao tác này'
      });
    }

    // Validate approval status
    if (!['approved', 'rejected'].includes(approval_status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái phê duyệt không hợp lệ'
      });
    }

    // Validate rejection reason if rejecting
    if (approval_status === 'rejected' && (!rejection_reason || rejection_reason.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Lý do từ chối là bắt buộc khi từ chối chapter'
      });
    }

    // Find the chapter
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter không tồn tại'
      });
    }

    // Update chapter approval status
    const updateData = {
      approval_status,
      approval_metadata: {
        ...chapter.approval_metadata,
        approved_by: req.user.id,
        approved_at: approval_status === 'approved' ? new Date() : chapter.approval_metadata?.approved_at,
        rejected_at: approval_status === 'rejected' ? new Date() : chapter.approval_metadata?.rejected_at,
        rejection_reason: approval_status === 'rejected' ? rejection_reason.trim() : chapter.approval_metadata?.rejection_reason
      }
    };

    // If approved, also change status to published
    if (approval_status === 'approved') {
      updateData.status = 'published';
    }

    const updatedChapter = await Chapter.findByIdAndUpdate(
      chapterId,
      updateData,
      { new: true }
    );

    const actionText = approval_status === 'approved' ? 'phê duyệt' : 'từ chối';
    
    res.json({
      success: true,
      message: `Đã ${actionText} chapter "${updatedChapter.name}" thành công!`,
      data: updatedChapter
    });

  } catch (error) {
    console.error('[Admin] Update chapter approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật trạng thái phê duyệt chapter',
      error: error.message
    });
  }
};

/**
 * Get chapter approval statistics
 */
exports.getChapterApprovalStats = async (req, res) => {
  try {
    console.log('[Admin] Getting chapter approval statistics');

    // Verify admin role
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền truy cập'
      });
    }

    // Get statistics
    const [
      pendingCount,
      approvedCount,
      rejectedCount,
      totalCount,
      recentActivities
    ] = await Promise.all([
      Chapter.countDocuments({ status: 'draft', approval_status: { $in: ['pending', 'not_submitted'] } }),
      Chapter.countDocuments({ approval_status: 'approved' }),
      Chapter.countDocuments({ approval_status: 'rejected' }),
      Chapter.countDocuments({}),
      Chapter.find({
        approval_status: { $in: ['approved', 'rejected'] },
        'approval_metadata.approved_at': { $exists: true }
      })
        .populate('story_id', 'name')
        .sort({ 'approval_metadata.approved_at': -1, 'approval_metadata.rejected_at': -1 })
        .limit(10)
        .select('name approval_status approval_metadata story_id')
        .lean()
    ]);

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
    console.error('[Admin] Get chapter approval stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê phê duyệt chapter',
      error: error.message
    });
  }
};
