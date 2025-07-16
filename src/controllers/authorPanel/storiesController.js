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

    // Check if user is admin (admins can view all stories)
    const isAdmin = req.user.role === 'admin';

    let author = null;
    let authorFilter = {};

    if (isAdmin) {
      // Admin users can view all stories or stories from all authors
      // For now, let's show all stories (you can modify this logic as needed)
      authorFilter = {}; // No filter = all stories
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

      authorFilter = { author_id: author._id };
    }

    // Build query
    const query = { ...authorFilter };

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { desc: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Add category filter
    if (category) {
      query.categories = new mongoose.Types.ObjectId(category);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get stories with pagination
    const [stories, totalStories] = await Promise.all([
      Story.find(query)
        .populate('categories', 'name slug')
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

    // Get story details
    const story = await Story.findOne({ 
      _id: storyId, 
      author_id: author._id 
    }).populate('categories', 'name slug').lean();

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

    // Create story data
    const storyData = {
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      image: image || '',
      banner: banner || '',
      desc: desc || '',
      author_id: [author._id],
      categories: categories || [],
      status,
      is_hot,
      is_new,
      is_full,
      show_ads,
      isPaid,
      price: isPaid ? price : 0,
      view: 0,
      like: 0,
      comment: 0
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
