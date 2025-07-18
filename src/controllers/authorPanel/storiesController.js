const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const Author = require('../../models/author');
const Category = require('../../models/category');
const mongoose = require('mongoose');

/**
 * Get author's stories with pagination and filters
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAuthorStories = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      category = '',
      sort = '-updatedAt'
    } = req.query;

    console.log(`[AuthorPanel] Getting stories for user: ${userId}`);

    // Use the same logic as dashboard controller to ensure consistency
    const isAdmin = req.user.role === 'admin';
    let author = null;

    if (isAdmin) {
      // For admin users, find first available approved system author (same as dashboard)
      author = await Author.findOne({
        authorType: 'system',
        approvalStatus: 'approved'
      });

      if (!author) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tác giả nào trong hệ thống.'
        });
      }
    } else {
      // For regular users, find their author record
      author = await Author.findOne({
        userId: userId,
        authorType: 'system',
        approvalStatus: 'approved'
      });

      if (!author) {
        return res.status(404).json({
          success: false,
          message: 'Tác giả không tồn tại hoặc chưa được phê duyệt. Vui lòng đăng ký làm tác giả trước.'
        });
      }
    }

    // Always filter by author_id - users should only see their own stories in author panel
    const authorFilter = { author_id: author._id };

    // Build query
    const query = { ...authorFilter };

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { desc: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter - show only published stories by default in author panel
    if (status && status !== 'all') {
      query.status = status;
    } else {
      // Default to showing only published stories
      query.status = 'published';
    }

    // Exclude soft-deleted stories
    query.deleted = { $ne: true };

    // Add category filter
    if (category) {
      query.categories = new mongoose.Types.ObjectId(category);
    }



    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get stories with pagination and populate author references
    const [stories, totalStories] = await Promise.all([
      Story.find(query)
        .populate('categories', 'name slug')
        .populate({
          path: 'author_id',
          select: 'name slug authorType userId status approvalStatus',
          populate: {
            path: 'userId',
            select: 'name email avatar coins',
            model: 'User'
          }
        })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Story.countDocuments(query)
    ]);



    // Get chapter counts for each story
    const storiesWithChapterCounts = await Promise.all(
      stories.map(async (story) => {
        const chapterCount = await Chapter.countDocuments({ story_id: story._id });
        return {
          ...story,
          chapterCount
        };
      })
    );

    const totalPages = Math.ceil(totalStories / parseInt(limit));

    res.json({
      success: true,
      data: {
        stories: storiesWithChapterCounts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalStories,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get stories error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách truyện',
      error: error.message
    });
  }
};

/**
 * Get author's draft stories with pagination and filters
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAuthorDraftStories = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      search = '',
      sort = '-updatedAt',
      approval_status = '',
      categories = '',
      date_from = '',
      date_to = '',
      status_filter = 'draft' // Default to draft only, but allow other statuses
    } = req.query;

    console.log(`[AuthorPanel] Getting draft stories for user: ${userId}`);

    // Find author record for the current user
    const author = await Author.findOne({
      userId: userId,
      authorType: 'system',
      approvalStatus: 'approved'
    });

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại hoặc chưa được phê duyệt. Vui lòng đăng ký làm tác giả trước.'
      });
    }

    // Build comprehensive query with filters
    const query = {
      author_id: author._id
    };

    // Status filter - allow multiple statuses or default to draft
    if (status_filter && status_filter !== 'all') {
      if (status_filter.includes(',')) {
        query.status = { $in: status_filter.split(',') };
      } else {
        query.status = status_filter;
      }
    } else if (!status_filter || status_filter === 'draft') {
      query.status = 'draft'; // Default behavior
    }

    // Approval status filter
    if (approval_status && approval_status !== 'all') {
      query.approval_status = approval_status;
    }

    // Category filter
    if (categories) {
      const categoryIds = categories.split(',');
      query.categories = { $in: categoryIds };
    }

    // Date range filters
    if (date_from || date_to) {
      query.createdAt = {};
      if (date_from) {
        query.createdAt.$gte = new Date(date_from);
      }
      if (date_to) {
        query.createdAt.$lte = new Date(date_to);
      }
    }

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { desc: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get stories with pagination and populate author references
    const [stories, totalStories] = await Promise.all([
      Story.find(query)
        .populate('categories', 'name slug')
        .populate({
          path: 'author_id',
          select: 'name slug authorType userId status approvalStatus',
          populate: {
            path: 'userId',
            select: 'name email avatar coins',
            model: 'User'
          }
        })
        .select(`
          name slug image banner desc categories status approval_status
          is_hot is_new is_full show_ads isPaid price view comment
          createdAt updatedAt approval_metadata author_id
        `)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Story.countDocuments(query)
    ]);

    // Get chapter counts for each story
    const storiesWithChapterCounts = await Promise.all(
      stories.map(async (story) => {
        const chapterCount = await Chapter.countDocuments({ story_id: story._id });
        return {
          ...story,
          chapterCount
        };
      })
    );

    const totalPages = Math.ceil(totalStories / parseInt(limit));

    res.json({
      success: true,
      data: {
        stories: storiesWithChapterCounts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalStories,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get draft stories error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách truyện nháp',
      error: error.message
    });
  }
};

/**
 * Get single story details for editing
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getStoryDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storyId } = req.params;

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

    // Get story details with populated author references
    const story = await Story.findOne({
      _id: storyId,
      author_id: author._id
    })
    .populate('categories', 'name slug')
    .populate({
      path: 'author_id',
      select: 'name slug authorType userId status approvalStatus',
      populate: {
        path: 'userId',
        select: 'name email avatar coins',
        model: 'User'
      }
    })
    .lean();

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại hoặc bạn không có quyền truy cập'
      });
    }

    // Get chapter count and latest chapter
    const [chapterCount, latestChapter] = await Promise.all([
      Chapter.countDocuments({ story_id: story._id }),
      Chapter.findOne({ story_id: story._id })
        .sort({ chapter: -1 })
        .select('name chapter createdAt')
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        ...story,
        chapterCount,
        latestChapter
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get story details error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết truyện',
      error: error.message
    });
  }
};

/**
 * Create new story
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.createStory = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      slug,
      image,
      banner,
      desc,
      categories,
      status = 'draft',
      is_hot = false,
      is_new = true,
      is_full = false,
      show_ads = false,
      isPaid = false,
      price = 0
    } = req.body;

    console.log(`[AuthorPanel] Creating story for user: ${userId}`);

    // Find author record
    const author = await Author.findOne({ 
      userId: userId, 
      authorType: 'system',
      approvalStatus: 'approved'
    });

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại hoặc chưa được phê duyệt'
      });
    }

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tên truyện là bắt buộc'
      });
    }

    // Check if slug already exists
    if (slug) {
      const existingStory = await Story.findOne({ slug });
      if (existingStory) {
        return res.status(400).json({
          success: false,
          message: 'Slug đã tồn tại'
        });
      }
    }

    // Determine approval status based on user role
    const user = req.user;
    const isAdmin = user.role === 'admin';

    // Create story data
    const storyData = {
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      image: image || '',
      banner: banner || '',
      desc: desc || '',
      author_id: [author._id],
      categories: categories || [],
      status: status || 'draft', // Ensure status is a string
      approval_status: isAdmin ? 'approved' : 'pending', // Auto-approve for admins
      is_hot,
      is_new,
      is_full,
      show_ads,
      isPaid,
      price: isPaid ? price : 0,
      view: 0,
      like: 0,
      comment: 0,
      approval_metadata: {
        approved_by: isAdmin ? user.id : null,
        approved_at: isAdmin ? new Date() : null,
        submission_count: 1,
        last_submitted_at: new Date()
      }
    };

    // Create new story
    const newStory = new Story(storyData);
    await newStory.save();

    // Populate categories for response
    await newStory.populate('categories', 'name slug');

    res.status(201).json({
      success: true,
      message: 'Tạo truyện mới thành công',
      data: newStory
    });

  } catch (error) {
    console.error('[AuthorPanel] Create story error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo truyện mới',
      error: error.message
    });
  }
};

/**
 * Update existing story
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateStory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storyId } = req.params;
    const updateData = req.body;

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

    // Check if story exists and belongs to author
    const story = await Story.findOne({ 
      _id: storyId, 
      author_id: author._id 
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại hoặc bạn không có quyền chỉnh sửa'
      });
    }

    // Check slug uniqueness if being updated
    if (updateData.slug && updateData.slug !== story.slug) {
      const existingStory = await Story.findOne({ 
        slug: updateData.slug,
        _id: { $ne: storyId }
      });
      if (existingStory) {
        return res.status(400).json({
          success: false,
          message: 'Slug đã tồn tại'
        });
      }
    }

    // Update story
    const updatedStory = await Story.findByIdAndUpdate(
      storyId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('categories', 'name slug');

    res.json({
      success: true,
      message: 'Cập nhật truyện thành công',
      data: updatedStory
    });

  } catch (error) {
    console.error('[AuthorPanel] Update story error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật truyện',
      error: error.message
    });
  }
};

/**
 * Delete story (soft delete)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.deleteStory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storyId } = req.params;

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

    // Check if story exists and belongs to author
    const story = await Story.findOne({
      _id: storyId,
      author_id: author._id
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại hoặc bạn không có quyền xóa'
      });
    }

    // Soft delete by updating status
    await Story.findByIdAndUpdate(storyId, {
      status: 'deleted',
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Xóa truyện thành công'
    });

  } catch (error) {
    console.error('[AuthorPanel] Delete story error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa truyện',
      error: error.message
    });
  }
};

/**
 * Delete draft story (soft delete) - specific for draft stories
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.deleteDraftStory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storyId } = req.params;

    console.log(`[AuthorPanel] Delete draft story request - User: ${userId}, Story: ${storyId}`);

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

    // Check if story exists, belongs to author, and is a draft
    const story = await Story.findOne({
      _id: storyId,
      author_id: author._id,
      status: 'draft' // Only allow deletion of draft stories
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Truyện nháp không tồn tại hoặc bạn không có quyền xóa'
      });
    }

    // Soft delete by updating status
    await Story.findByIdAndUpdate(storyId, {
      status: 'deleted',
      updatedAt: new Date()
    });

    console.log(`[AuthorPanel] Draft story deleted successfully - Story: ${storyId}`);

    res.json({
      success: true,
      message: 'Xóa truyện nháp thành công'
    });

  } catch (error) {
    console.error('[AuthorPanel] Delete draft story error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa truyện nháp',
      error: error.message
    });
  }
};

/**
 * Update story status
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateStoryStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storyId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['draft', 'published', 'completed', 'paused'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ'
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

    // Update story status
    const updatedStory = await Story.findOneAndUpdate(
      { _id: storyId, author_id: author._id },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedStory) {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại hoặc bạn không có quyền cập nhật'
      });
    }

    res.json({
      success: true,
      message: 'Cập nhật trạng thái truyện thành công',
      data: { status: updatedStory.status }
    });

  } catch (error) {
    console.error('[AuthorPanel] Update story status error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật trạng thái truyện',
      error: error.message
    });
  }
};

/**
 * Resubmit story for admin approval
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.resubmitStoryForApproval = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storyId } = req.params;
    const { note = '' } = req.body;

    console.log(`[AuthorPanel] Resubmitting story ${storyId} for approval by user: ${userId}`);

    // Find author record for the current user
    const author = await Author.findOne({
      userId: userId,
      authorType: 'system',
      approvalStatus: 'approved'
    });

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại hoặc chưa được phê duyệt. Vui lòng đăng ký làm tác giả trước.'
      });
    }

    // Find the story and verify ownership
    const story = await Story.findOne({
      _id: storyId,
      author_id: author._id
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện hoặc bạn không có quyền truy cập truyện này.'
      });
    }

    // Validate that story can be resubmitted
    const allowedStatuses = ['rejected', 'not_submitted'];
    if (!allowedStatuses.includes(story.approval_status)) {
      return res.status(400).json({
        success: false,
        error: `Chỉ có thể nộp lại truyện có trạng thái 'Đã bị từ chối' hoặc 'Chưa gửi duyệt'. Trạng thái hiện tại: ${story.approval_status}`
      });
    }

    // Prepare resubmission data
    const currentTime = new Date();
    const submissionCount = (story.approval_metadata?.submission_count || 0) + 1;

    // Prepare resubmission history entry
    const resubmissionEntry = {
      submission_count: submissionCount,
      submitted_at: currentTime,
      note: note.trim(),
      previous_status: story.approval_status
    };

    // Update story with resubmission data
    const updateData = {
      approval_status: 'pending',
      'approval_metadata.submission_count': submissionCount,
      'approval_metadata.last_submitted_at': currentTime,
      'approval_metadata.current_note': note.trim(),
      // Clear previous rejection data
      $unset: {
        'approval_metadata.rejection_reason': '',
        'approval_metadata.rejected_at': '',
        'approval_metadata.rejected_by': ''
      },
      // Add to resubmission history
      $push: {
        'approval_metadata.resubmission_history': resubmissionEntry
      }
    };

    const updatedStory = await Story.findByIdAndUpdate(
      storyId,
      updateData,
      { new: true, runValidators: true }
    ).populate('categories', 'name slug');

    console.log(`[AuthorPanel] Story ${storyId} resubmitted successfully. Submission count: ${submissionCount}`);

    res.json({
      success: true,
      message: `Đã nộp lại truyện "${story.name}" để duyệt thành công! Đây là lần nộp thứ ${submissionCount}.`,
      data: {
        story: {
          _id: updatedStory._id,
          name: updatedStory.name,
          approval_status: updatedStory.approval_status,
          submission_count: submissionCount,
          last_submitted_at: currentTime,
          note: note.trim()
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Resubmit story error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi nộp lại truyện để duyệt',
      error: error.message
    });
  }
};

/**
 * Get categories for dropdown
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ status: true })
      .select('name slug')
      .sort('name')
      .lean();

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('[AuthorPanel] Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách thể loại',
      error: error.message
    });
  }
};

/**
 * Resubmit rejected story for approval
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.resubmitStory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storyId } = req.params;

    console.log(`[AuthorPanel] Resubmitting story ${storyId} for user: ${userId}`);

    // Find author record
    const author = await Author.findOne({
      userId: userId,
      authorType: 'system',
      approvalStatus: 'approved'
    });

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại hoặc chưa được phê duyệt'
      });
    }

    // Find story and verify ownership
    const story = await Story.findOne({
      _id: storyId,
      author_id: author._id
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại hoặc bạn không có quyền truy cập'
      });
    }

    // Check if story is in rejected status
    if (story.approval_status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể gửi lại truyện đã bị từ chối'
      });
    }

    // Check if story has been modified since rejection
    const lastModified = story.updatedAt;
    const rejectedAt = story.approval_metadata.rejected_at;

    if (rejectedAt && lastModified <= rejectedAt) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chỉnh sửa nội dung truyện trước khi gửi lại'
      });
    }

    // Update approval status to pending
    story.approval_status = 'pending';
    story.approval_metadata.rejection_reason = '';
    story.approval_metadata.rejected_at = null;

    await story.save();

    res.json({
      success: true,
      message: 'Đã gửi lại truyện để phê duyệt thành công',
      data: {
        storyId: story._id,
        approval_status: story.approval_status,
        submission_count: story.approval_metadata.submission_count
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Resubmit story error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi lại truyện',
      error: error.message
    });
  }
};

/**
 * Get stories with approval status filter
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getStoriesByApprovalStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { approval_status, page = 1, limit = 10 } = req.query;

    console.log(`[AuthorPanel] Getting stories by approval status: ${approval_status} for user: ${userId}`);

    // Find author record
    const author = await Author.findOne({
      userId: userId,
      authorType: 'system',
      approvalStatus: 'approved'
    });

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Tác giả không tồn tại hoặc chưa được phê duyệt'
      });
    }

    // Build query
    const query = { author_id: author._id };
    if (approval_status && ['pending', 'approved', 'rejected'].includes(approval_status)) {
      query.approval_status = approval_status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get stories with pagination and populate author references
    const [stories, totalCount] = await Promise.all([
      Story.find(query)
        .populate('categories', 'name slug')
        .populate({
          path: 'author_id',
          select: 'name slug authorType userId status approvalStatus',
          populate: {
            path: 'userId',
            select: 'name email avatar coins',
            model: 'User'
          }
        })
        .sort({ 'approval_metadata.last_submitted_at': -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Story.countDocuments(query)
    ]);

    // Get chapter counts for each story
    const storiesWithCounts = await Promise.all(
      stories.map(async (story) => {
        const chapterCount = await Chapter.countDocuments({ story_id: story._id });
        return {
          ...story,
          chapterCount
        };
      })
    );

    res.json({
      success: true,
      data: storiesWithCounts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        total: totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get stories by approval status error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách truyện',
      error: error.message
    });
  }
};
