const Chapter = require('../../models/chapter');
const Story = require('../../models/story');
const Author = require('../../models/author');
const mongoose = require('mongoose');

/**
 * Get chapters for a specific story
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getStoryChapters = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storyId } = req.params;
    const {
      page = 1,
      limit = 50,
      search = '',
      sort = 'chapter'
    } = req.query;

    // Check if user is admin (admins can view all chapters)
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let story = null;

    if (isAdmin) {
      // Admin users can view chapters for any story
      story = await Story.findById(storyId);
    } else {
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

      // Verify story belongs to author
      story = await Story.findOne({
        _id: storyId,
        author_id: author._id
      });
    }

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại hoặc bạn không có quyền truy cập'
      });
    }

    // Build query
    const query = { story_id: storyId };

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get chapters with pagination
    const [chapters, totalChapters] = await Promise.all([
      Chapter.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-content') // Exclude content for list view
        .lean(),
      Chapter.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalChapters / parseInt(limit));

    res.json({
      success: true,
      data: {
        story: {
          id: story._id,
          name: story.name,
          slug: story.slug
        },
        chapters,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalChapters,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get story chapters error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách chapter',
      error: error.message
    });
  }
};

/**
 * Get single chapter details for editing
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getChapterDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;

    // Check if user is admin (admins can view all chapters)
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let chapter = null;

    if (isAdmin) {
      // Admin users can view any chapter
      chapter = await Chapter.findById(chapterId)
        .populate({
          path: 'story_id',
          select: 'name slug author_id'
        })
        .lean();
    } else {
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

      // Get chapter with story info and verify ownership
      chapter = await Chapter.findById(chapterId)
        .populate({
          path: 'story_id',
          select: 'name slug author_id',
          match: { author_id: author._id }
        })
        .lean();
    }

    if (!chapter || !chapter.story_id) {
      return res.status(404).json({
        success: false,
        message: 'Chapter không tồn tại hoặc bạn không có quyền truy cập'
      });
    }

    res.json({
      success: true,
      data: chapter
    });

  } catch (error) {
    console.error('[AuthorPanel] Get chapter details error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết chapter',
      error: error.message
    });
  }
};

/**
 * Create new chapter
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.createChapter = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storyId } = req.params;
    const {
      chapter,
      name,
      slug,
      content,
      audio,
      audio_show = false,
      show_ads = false,
      link_ref = '',
      pass_code = '',
      is_new = true,
      status = 'draft'
    } = req.body;

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

    // Verify story belongs to author
    const story = await Story.findOne({ 
      _id: storyId, 
      author_id: author._id 
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Truyện không tồn tại hoặc bạn không có quyền thêm chapter'
      });
    }

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tên chapter là bắt buộc'
      });
    }

    if (chapter === undefined || chapter === null) {
      return res.status(400).json({
        success: false,
        message: 'Số chapter là bắt buộc'
      });
    }

    // Check if chapter number already exists for this story
    const existingChapter = await Chapter.findOne({ 
      story_id: storyId, 
      chapter: parseInt(chapter) 
    });

    if (existingChapter) {
      return res.status(400).json({
        success: false,
        message: 'Số chapter đã tồn tại'
      });
    }

    // Create chapter data with approval workflow
    const chapterData = {
      story_id: storyId,
      chapter: parseInt(chapter),
      name,
      slug: slug || `${story.slug}-chapter-${chapter}`,
      content: content || '',
      audio: audio || '',
      audio_show,
      show_ads,
      link_ref,
      pass_code,
      is_new,
      status: 'draft', // Always start as draft
      approval_status: 'pending', // Automatically submit for approval
      approval_metadata: {
        submission_count: 1,
        last_submitted_at: new Date(),
        current_note: 'Chapter được tạo mới và tự động gửi duyệt'
      }
    };

    // Create new chapter
    const newChapter = new Chapter(chapterData);
    await newChapter.save();

    // Update story's updated timestamp
    await Story.findByIdAndUpdate(storyId, { updatedAt: new Date() });

    res.status(201).json({
      success: true,
      message: 'Tạo chapter mới thành công và đã gửi duyệt. Chapter sẽ được hiển thị sau khi admin phê duyệt.',
      data: newChapter
    });

  } catch (error) {
    console.error('[AuthorPanel] Create chapter error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo chapter mới',
      error: error.message
    });
  }
};

/**
 * Update existing chapter
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateChapter = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
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

    // Get chapter with story info to verify ownership
    const chapter = await Chapter.findById(chapterId)
      .populate({
        path: 'story_id',
        select: 'author_id',
        match: { author_id: author._id }
      });

    if (!chapter || !chapter.story_id) {
      return res.status(404).json({
        success: false,
        message: 'Chapter không tồn tại hoặc bạn không có quyền chỉnh sửa'
      });
    }

    // Check chapter number uniqueness if being updated
    if (updateData.chapter && updateData.chapter !== chapter.chapter) {
      const existingChapter = await Chapter.findOne({ 
        story_id: chapter.story_id._id,
        chapter: parseInt(updateData.chapter),
        _id: { $ne: chapterId }
      });
      if (existingChapter) {
        return res.status(400).json({
          success: false,
          message: 'Số chapter đã tồn tại'
        });
      }
    }

    // Update chapter
    const updatedChapter = await Chapter.findByIdAndUpdate(
      chapterId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    // Update story's updated timestamp
    await Story.findByIdAndUpdate(chapter.story_id._id, { updatedAt: new Date() });

    res.json({
      success: true,
      message: 'Cập nhật chapter thành công',
      data: updatedChapter
    });

  } catch (error) {
    console.error('[AuthorPanel] Update chapter error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật chapter',
      error: error.message
    });
  }
};

/**
 * Delete chapter
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.deleteChapter = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;

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

    // Get chapter with story info to verify ownership
    const chapter = await Chapter.findById(chapterId)
      .populate({
        path: 'story_id',
        select: 'author_id',
        match: { author_id: author._id }
      });

    if (!chapter || !chapter.story_id) {
      return res.status(404).json({
        success: false,
        message: 'Chapter không tồn tại hoặc bạn không có quyền xóa'
      });
    }

    // Delete chapter
    await Chapter.findByIdAndDelete(chapterId);

    // Update story's updated timestamp
    await Story.findByIdAndUpdate(chapter.story_id._id, { updatedAt: new Date() });

    res.json({
      success: true,
      message: 'Xóa chapter thành công'
    });

  } catch (error) {
    console.error('[AuthorPanel] Delete chapter error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa chapter',
      error: error.message
    });
  }
};

/**
 * Resubmit chapter for admin approval
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.resubmitChapterForApproval = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    const { note = '' } = req.body;

    console.log(`[AuthorPanel] Resubmitting chapter ${chapterId} for approval by user: ${userId}`);

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

    // Find the chapter and verify ownership
    const chapter = await Chapter.findById(chapterId)
      .populate({
        path: 'story_id',
        select: 'author_id name',
        match: { author_id: author._id }
      });

    if (!chapter || !chapter.story_id) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chapter hoặc bạn không có quyền truy cập chapter này.'
      });
    }

    // Validate that chapter can be resubmitted
    const allowedStatuses = ['rejected', 'not_submitted'];
    if (!allowedStatuses.includes(chapter.approval_status)) {
      return res.status(400).json({
        success: false,
        error: `Chỉ có thể nộp lại chapter có trạng thái 'Đã bị từ chối' hoặc 'Chưa gửi duyệt'. Trạng thái hiện tại: ${chapter.approval_status}`
      });
    }

    // Prepare resubmission data
    const currentTime = new Date();
    const submissionCount = (chapter.approval_metadata?.submission_count || 0) + 1;

    // Prepare resubmission history entry
    const resubmissionEntry = {
      submission_count: submissionCount,
      submitted_at: currentTime,
      note: note.trim(),
      previous_status: chapter.approval_status
    };

    // Update chapter with resubmission data
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

    const updatedChapter = await Chapter.findByIdAndUpdate(
      chapterId,
      updateData,
      { new: true, runValidators: true }
    ).populate('story_id', 'name');

    console.log(`[AuthorPanel] Chapter ${chapterId} resubmitted successfully. Submission count: ${submissionCount}`);

    res.json({
      success: true,
      message: `Đã nộp lại chapter "${chapter.name}" để duyệt thành công! Đây là lần nộp thứ ${submissionCount}.`,
      data: {
        chapter: {
          _id: updatedChapter._id,
          name: updatedChapter.name,
          approval_status: updatedChapter.approval_status,
          submission_count: submissionCount,
          last_submitted_at: currentTime,
          note: note.trim(),
          story_name: updatedChapter.story_id?.name
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Resubmit chapter error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi nộp lại chapter để duyệt',
      error: error.message
    });
  }
};

/**
 * Get draft chapters across all stories for the authenticated author
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getDraftChapters = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      search = '',
      sort = '-updatedAt',
      approval_status,
      story_id
    } = req.query;

    console.log(`[AuthorPanel] Getting draft chapters for user: ${userId}`);

    // Check if user is admin (admins can view all chapters)
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let authorFilter = {};

    if (isAdmin) {
      // Admin users can view all draft chapters
      console.log('[AuthorPanel] Admin user - can view all draft chapters');
    } else {
      // Find author record for regular users
      author = await Author.findOne({
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

      // Filter by author's stories only
      authorFilter = { author_id: author._id };
    }

    // Build aggregation pipeline
    const pipeline = [];

    // Match stage - join with stories and filter by author
    const matchStage = {
      $lookup: {
        from: 'stories',
        localField: 'story_id',
        foreignField: '_id',
        as: 'story'
      }
    };
    pipeline.push(matchStage);

    // Unwind story array
    pipeline.push({ $unwind: '$story' });

    // Filter conditions
    const filterConditions = {
      status: 'draft' // Only draft chapters
    };

    // Add author filter for non-admin users
    if (!isAdmin) {
      filterConditions['story.author_id'] = author._id;
    }

    // Add approval status filter if specified
    if (approval_status && approval_status !== 'all') {
      filterConditions.approval_status = approval_status;
    }

    // Add story filter if specified
    if (story_id) {
      filterConditions.story_id = new mongoose.Types.ObjectId(story_id);
    }

    // Add search filter if specified
    if (search) {
      filterConditions.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'story.name': { $regex: search, $options: 'i' } }
      ];
    }

    pipeline.push({ $match: filterConditions });

    // Add story information to the output
    pipeline.push({
      $addFields: {
        story_info: {
          _id: '$story._id',
          name: '$story.name',
          slug: '$story.slug'
        }
      }
    });

    // Remove the full story object and keep only story_info
    pipeline.push({
      $project: {
        story: 0
      }
    });

    // Sort stage
    const sortStage = {};
    if (sort.startsWith('-')) {
      sortStage[sort.substring(1)] = -1;
    } else {
      sortStage[sort] = 1;
    }
    pipeline.push({ $sort: sortStage });

    // Count total documents
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Chapter.aggregate(countPipeline);
    const totalItems = countResult.length > 0 ? countResult[0].total : 0;

    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    // Execute aggregation
    const chapters = await Chapter.aggregate(pipeline);

    // Calculate pagination info
    const totalPages = Math.ceil(totalItems / parseInt(limit));

    console.log(`[AuthorPanel] Found ${chapters.length} draft chapters (total: ${totalItems})`);

    res.json({
      success: true,
      message: 'Lấy danh sách chapter nháp thành công',
      data: {
        draftChapters: chapters,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalItems,
          totalPages,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get draft chapters error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách chapter nháp',
      error: error.message
    });
  }
};

/**
 * Update chapter status
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateChapterStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['draft', 'published', 'scheduled'];
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

    // Get chapter with story info to verify ownership
    const chapter = await Chapter.findById(chapterId)
      .populate({
        path: 'story_id',
        select: 'author_id',
        match: { author_id: author._id }
      });

    if (!chapter || !chapter.story_id) {
      return res.status(404).json({
        success: false,
        message: 'Chapter không tồn tại hoặc bạn không có quyền cập nhật'
      });
    }

    // Update chapter status
    const updatedChapter = await Chapter.findByIdAndUpdate(
      chapterId,
      { status, updatedAt: new Date() },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Cập nhật trạng thái chapter thành công',
      data: { status: updatedChapter.status }
    });

  } catch (error) {
    console.error('[AuthorPanel] Update chapter status error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật trạng thái chapter',
      error: error.message
    });
  }
};

/**
 * Auto-save chapter content
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.autoSaveChapter = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    const { content } = req.body;

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

    // Get chapter with story info to verify ownership
    const chapter = await Chapter.findById(chapterId)
      .populate({
        path: 'story_id',
        select: 'author_id',
        match: { author_id: author._id }
      });

    if (!chapter || !chapter.story_id) {
      return res.status(404).json({
        success: false,
        message: 'Chapter không tồn tại hoặc bạn không có quyền chỉnh sửa'
      });
    }

    // Auto-save content
    await Chapter.findByIdAndUpdate(chapterId, {
      content,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Tự động lưu thành công'
    });

  } catch (error) {
    console.error('[AuthorPanel] Auto-save chapter error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tự động lưu',
      error: error.message
    });
  }
};

/**
 * Schedule chapter publication
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.scheduleChapter = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chapterId } = req.params;
    const { publishAt } = req.body;

    if (!publishAt) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian xuất bản là bắt buộc'
      });
    }

    const publishDate = new Date(publishAt);
    if (publishDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian xuất bản phải trong tương lai'
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

    // Get chapter with story info to verify ownership
    const chapter = await Chapter.findById(chapterId)
      .populate({
        path: 'story_id',
        select: 'author_id',
        match: { author_id: author._id }
      });

    if (!chapter || !chapter.story_id) {
      return res.status(404).json({
        success: false,
        message: 'Chapter không tồn tại hoặc bạn không có quyền lên lịch'
      });
    }

    // Update chapter with scheduled publication
    const updatedChapter = await Chapter.findByIdAndUpdate(
      chapterId,
      {
        status: 'scheduled',
        scheduledPublishAt: publishDate,
        updatedAt: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Lên lịch xuất bản chapter thành công',
      data: {
        chapterId: updatedChapter._id,
        status: updatedChapter.status,
        scheduledPublishAt: updatedChapter.scheduledPublishAt
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Schedule chapter error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lên lịch xuất bản',
      error: error.message
    });
  }
};

/**
 * Get publication schedule
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getPublicationSchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '30d' } = req.query;

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
    let endDate;
    switch (timeRange) {
      case '7d':
        endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Get scheduled chapters
    const scheduledChapters = await Chapter.aggregate([
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
          status: 'scheduled',
          scheduledPublishAt: {
            $gte: now,
            $lte: endDate
          }
        }
      },
      {
        $sort: { scheduledPublishAt: 1 }
      },
      {
        $project: {
          name: 1,
          chapter: 1,
          scheduledPublishAt: 1,
          'story.name': 1,
          'story.slug': 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        scheduledChapters,
        timeRange
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get publication schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch xuất bản',
      error: error.message
    });
  }
};

/**
 * Bulk update chapter statuses
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.bulkUpdateChapters = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chapterIds, status } = req.body;

    if (!chapterIds || !Array.isArray(chapterIds) || chapterIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Danh sách chapter không hợp lệ'
      });
    }

    const validStatuses = ['draft', 'published', 'scheduled'];
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

    // Verify all chapters belong to author
    const chapters = await Chapter.aggregate([
      {
        $match: {
          _id: { $in: chapterIds.map(id => new mongoose.Types.ObjectId(id)) }
        }
      },
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
    ]);

    if (chapters.length !== chapterIds.length) {
      return res.status(403).json({
        success: false,
        message: 'Một số chapter không thuộc quyền sở hữu của bạn'
      });
    }

    // Update chapters
    const result = await Chapter.updateMany(
      {
        _id: { $in: chapterIds.map(id => new mongoose.Types.ObjectId(id)) }
      },
      {
        status,
        updatedAt: new Date()
      }
    );

    res.json({
      success: true,
      message: `Cập nhật trạng thái ${result.modifiedCount} chapter thành công`,
      data: {
        updatedCount: result.modifiedCount,
        status
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Bulk update chapters error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật hàng loạt',
      error: error.message
    });
  }
};

/**
 * Get draft chapters
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getDraftChapters = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

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

    // Get draft chapters
    const [draftChapters, totalDrafts] = await Promise.all([
      Chapter.aggregate([
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
            status: 'draft'
          }
        },
        {
          $sort: { updatedAt: -1 }
        },
        {
          $skip: (parseInt(page) - 1) * parseInt(limit)
        },
        {
          $limit: parseInt(limit)
        },
        {
          $project: {
            name: 1,
            chapter: 1,
            updatedAt: 1,
            'story.name': 1,
            'story.slug': 1
          }
        }
      ]),

      Chapter.aggregate([
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
            status: 'draft'
          }
        },
        {
          $count: 'total'
        }
      ]).then(result => result[0]?.total || 0)
    ]);

    const totalPages = Math.ceil(totalDrafts / parseInt(limit));

    res.json({
      success: true,
      data: {
        draftChapters,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalDrafts,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('[AuthorPanel] Get draft chapters error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách bản nháp',
      error: error.message
    });
  }
};
