const Chapter = require('../../models/chapter');
const Story = require('../../models/story');
const mongoose = require('mongoose');
const slugify = require('slugify');
const hasPaidChaptersService = require('../story/hasPaidChaptersService');

class ChapterService {
  /**
   * Lấy tất cả các chapter
   * @returns {Promise<Array>} - Danh sách chapter
   */
  async getAllChapters() {
    return await Chapter.find();
  }

  /**
   * Lấy chapter theo ID
   * @param {string} id - ID của chapter
   * @returns {Promise<Object>} - Chapter tìm thấy với thông tin truyện
   */
  async getChapterById(id) {
    return await Chapter.findById(id).populate('story_id', 'name slug');
  }

  /**
   * Tạo chapter mới
   * @param {Object} chapterData - Dữ liệu chapter cần tạo
   * @returns {Promise<Object>} - Chapter đã tạo
   * @throws {Error} - Nếu story_id không hợp lệ hoặc không tìm thấy story
   */
  async createChapter(chapterData) {
    // Validate story_id
    if (!mongoose.Types.ObjectId.isValid(chapterData.story_id)) {
      throw new Error('Invalid story_id');
    }

    // Check if story exists
    const storyExists = await Story.findById(chapterData.story_id);
    if (!storyExists) {
      throw new Error('Story not found');
    }

    // Create chapter with new model structure
    const newChapterData = {
      kho_truyen_chapter_id: chapterData.kho_truyen_chapter_id || 0,
      story_id: chapterData.story_id,
      chapter: chapterData.chapter,
      name: chapterData.name,
      slug: chapterData.slug || '',
      content: chapterData.content || '',
      audio: chapterData.audio || '',
      audio_show: Boolean(chapterData.audio_show),
      show_ads: Boolean(chapterData.show_ads),
      link_ref: chapterData.link_ref || '',
      pass_code: chapterData.pass_code || '',
      is_new: Boolean(chapterData.is_new),
      status: chapterData.status !== undefined ? Boolean(chapterData.status) : true
    };

    // Add paid content fields if provided
    if (chapterData.isPaid !== undefined) newChapterData.isPaid = Boolean(chapterData.isPaid);
    if (chapterData.price !== undefined) newChapterData.price = Number(chapterData.price) || 0;

    // Tạo chapter mới
    const item = new Chapter(newChapterData);
    const savedChapter = await item.save();

    // Cập nhật chapter_count trong Story
    const currentCount = storyExists.chapter_count || 0;
    await Story.findByIdAndUpdate(
      chapterData.story_id,
      { chapter_count: currentCount + 1 }
    );

    // AUTO-UPDATE: Update story's hasPaidChapters field if chapter is paid
    if (newChapterData.isPaid) {
      try {
        await hasPaidChaptersService.updateStoryHasPaidChapters(chapterData.story_id);
        console.log(`[ChapterService] Auto-updated hasPaidChapters for story ${chapterData.story_id} after creating paid chapter`);
      } catch (error) {
        console.error('[ChapterService] Error auto-updating hasPaidChapters:', error);
        // Don't throw error - chapter creation should succeed even if hasPaidChapters update fails
      }
    }

    return savedChapter;
  }

  /**
   * Cập nhật chapter
   * @param {string} id - ID của chapter
   * @param {Object} updateData - Dữ liệu cần cập nhật
   * @returns {Promise<Object>} - Chapter sau khi cập nhật
   */
  async updateChapter(id, updateData) {
    // Tìm chapter hiện tại để lấy story_id cũ
    const currentChapter = await Chapter.findById(id);
    if (!currentChapter) {
      throw new Error('Chapter not found');
    }

    const oldStoryId = currentChapter.story_id;
    const newStoryId = updateData.story_id;

    // Kiểm tra nếu có thay đổi story_id
    const isStoryChanged = newStoryId && newStoryId.toString() !== oldStoryId.toString();

    // Prepare update data
    const dataToUpdate = {};

    // Track if paid status is changing for auto-update logic
    const oldIsPaid = currentChapter.isPaid || false;
    const newIsPaid = updateData.isPaid !== undefined ? Boolean(updateData.isPaid) : oldIsPaid;
    const isPaidStatusChanged = oldIsPaid !== newIsPaid;

    // Only update fields that are present in request
    if (updateData.kho_truyen_chapter_id !== undefined) dataToUpdate.kho_truyen_chapter_id = updateData.kho_truyen_chapter_id;
    if (updateData.story_id !== undefined) dataToUpdate.story_id = updateData.story_id;
    if (updateData.chapter !== undefined) dataToUpdate.chapter = updateData.chapter;
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.slug !== undefined) dataToUpdate.slug = updateData.slug;
    if (updateData.content !== undefined) dataToUpdate.content = updateData.content;
    if (updateData.audio !== undefined) dataToUpdate.audio = updateData.audio;
    if (updateData.audio_show !== undefined) dataToUpdate.audio_show = Boolean(updateData.audio_show);
    if (updateData.show_ads !== undefined) dataToUpdate.show_ads = Boolean(updateData.show_ads);
    if (updateData.link_ref !== undefined) dataToUpdate.link_ref = updateData.link_ref;
    if (updateData.pass_code !== undefined) dataToUpdate.pass_code = updateData.pass_code;
    if (updateData.is_new !== undefined) dataToUpdate.is_new = Boolean(updateData.is_new);
    if (updateData.status !== undefined) dataToUpdate.status = Boolean(updateData.status);

    // Add paid content fields
    if (updateData.isPaid !== undefined) dataToUpdate.isPaid = Boolean(updateData.isPaid);
    if (updateData.price !== undefined) dataToUpdate.price = Number(updateData.price) || 0;

    // Cập nhật chapter
    const updatedChapter = await Chapter.findByIdAndUpdate(
      id,
      dataToUpdate,
      { new: true }
    );

    // Nếu có thay đổi story_id, cập nhật chapter_count cho cả truyện cũ và mới
    if (isStoryChanged) {
      // Giảm chapter_count của truyện cũ
      const oldStory = await Story.findById(oldStoryId);
      if (oldStory) {
        const oldCount = oldStory.chapter_count || 0;
        if (oldCount > 0) {
          await Story.findByIdAndUpdate(
            oldStoryId,
            { chapter_count: oldCount - 1 }
          );
        }
      }

      // Tăng chapter_count của truyện mới
      const newStory = await Story.findById(newStoryId);
      if (newStory) {
        const newCount = newStory.chapter_count || 0;
        await Story.findByIdAndUpdate(
          newStoryId,
          { chapter_count: newCount + 1 }
        );
      }

      // AUTO-UPDATE: Update hasPaidChapters for both old and new stories
      try {
        await hasPaidChaptersService.updateStoryHasPaidChapters(oldStoryId);
        await hasPaidChaptersService.updateStoryHasPaidChapters(newStoryId);
        console.log(`[ChapterService] Auto-updated hasPaidChapters for both stories after chapter move`);
      } catch (error) {
        console.error('[ChapterService] Error auto-updating hasPaidChapters after story change:', error);
      }
    } else if (isPaidStatusChanged) {
      // AUTO-UPDATE: Update hasPaidChapters if paid status changed
      try {
        await hasPaidChaptersService.updateStoryHasPaidChapters(oldStoryId);
        console.log(`[ChapterService] Auto-updated hasPaidChapters for story ${oldStoryId} after isPaid change: ${oldIsPaid} -> ${newIsPaid}`);
      } catch (error) {
        console.error('[ChapterService] Error auto-updating hasPaidChapters after isPaid change:', error);
      }
    }

    return updatedChapter;
  }

  /**
   * Xóa chapter
   * @param {string} id - ID của chapter cần xóa
   * @returns {Promise<Object>} - Chapter đã xóa
   */
  async deleteChapter(id) {
    // Tìm chapter để lấy story_id trước khi xóa
    const chapter = await Chapter.findById(id);
    if (!chapter) {
      throw new Error('Chapter not found');
    }

    const storyId = chapter.story_id;
    const wasChapterPaid = chapter.isPaid || false;

    // Xóa chapter
    const deletedChapter = await Chapter.findByIdAndDelete(id);

    // Cập nhật chapter_count trong Story
    if (storyId) {
      const story = await Story.findById(storyId);
      if (story) {
        const currentCount = story.chapter_count || 0;
        if (currentCount > 0) {
          await Story.findByIdAndUpdate(
            storyId,
            { chapter_count: currentCount - 1 }
          );
        }
      }

      // AUTO-UPDATE: Update hasPaidChapters if deleted chapter was paid
      if (wasChapterPaid) {
        try {
          await hasPaidChaptersService.updateStoryHasPaidChapters(storyId);
          console.log(`[ChapterService] Auto-updated hasPaidChapters for story ${storyId} after deleting paid chapter`);
        } catch (error) {
          console.error('[ChapterService] Error auto-updating hasPaidChapters after chapter deletion:', error);
        }
      }
    }

    return deletedChapter;
  }

  /**
   * Lấy chapter theo story ID
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Array>} - Danh sách chapter của truyện
   * @throws {Error} - Nếu story ID không hợp lệ
   */
  async findByStoryId(storyId) {
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      throw new Error('Invalid story ID');
    }

    return await Chapter.find({ story_id: storyId })
      .sort({ chapter: 1 });
  }

  /**
   * Lấy chapter mới nhất theo story ID
   * @param {string} storyId - ID của truyện
   * @returns {Promise<Object>} - Chapter mới nhất
   * @throws {Error} - Nếu story ID không hợp lệ hoặc không tìm thấy chapter
   */
  async getLatestChapter(storyId) {
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      throw new Error('Invalid story ID');
    }

    const chapter = await Chapter.findOne({ story_id: storyId })
      .sort({ chapter: -1 })
      .limit(1);

    if (!chapter) {
      throw new Error('No chapters found');
    }

    return chapter;
  }

  /**
   * Lấy thông tin chi tiết của một chapter theo slug
   * @param {string} slug - Slug của chapter
   * @returns {Promise<Object>} - Thông tin chi tiết của chapter
   * @throws {Error} - Nếu không tìm thấy chapter hoặc truyện
   */
  async getChapterBySlug(slug) {
    // Tìm chapter theo slug hoặc một phần của slug
    let chapter = await Chapter.findOne({ slug, status: true });

    // Nếu không tìm thấy, thử tìm với slug chứa một phần của slug đã cho
    if (!chapter) {
      const regex = new RegExp(slug, 'i');
      chapter = await Chapter.findOne({ slug: regex, status: true });
    }

    if (!chapter) {
      throw new Error('Không tìm thấy chapter');
    }

    // Lấy thông tin truyện
    const story = await Story.findById(chapter.story_id);

    if (!story) {
      throw new Error('Không tìm thấy truyện của chapter này');
    }

    // Lấy tổng số chapter của truyện
    const totalChapters = await Chapter.countDocuments({
      story_id: story._id,
      status: true
    });

    // Lấy chapter trước và sau
    const prevChapter = await Chapter.findOne({
      story_id: story._id,
      chapter: { $lt: chapter.chapter },
      status: true
    }).sort({ chapter: -1 });

    const nextChapter = await Chapter.findOne({
      story_id: story._id,
      chapter: { $gt: chapter.chapter },
      status: true
    }).sort({ chapter: 1 });

    // Tạo đối tượng navigation
    const navigation = {
      prev: prevChapter ? {
        id: prevChapter._id,
        chapter: prevChapter.chapter,
        name: prevChapter.name,
        slug: prevChapter.slug
      } : null,
      next: nextChapter ? {
        id: nextChapter._id,
        chapter: nextChapter.chapter,
        name: nextChapter.name,
        slug: nextChapter.slug
      } : null
    };

    return {
      success: true,
      chapter: {
        _id: chapter._id,
        chapter: chapter.chapter,
        name: chapter.name,
        content: chapter.content,
        slug: chapter.slug,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt
      },
      story: {
        id: story._id,
        name: story.name,
        slug: story.slug
      },
      navigation,
      totalChapters
    };
  }

  /**
   * Lấy thông tin chi tiết của một chapter theo slug của chapter và slug của truyện
   * @param {string} storySlug - Slug của truyện
   * @param {string} chapterSlug - Slug của chapter
   * @returns {Promise<Object>} - Thông tin chi tiết của chapter
   * @throws {Error} - Nếu không tìm thấy truyện hoặc chapter
   */
  async getChapterByStoryAndChapterSlug(storySlug, chapterSlug) {
    // Tìm truyện theo slug
    const story = await Story.findOne({ slug: storySlug });

    if (!story) {
      throw new Error('Không tìm thấy truyện');
    }

    // Tìm chapter theo slug và story_id
    let chapter = await Chapter.findOne({
      slug: chapterSlug,
      story_id: story._id,
      status: true
    });

    if (!chapter) {
      throw new Error('Không tìm thấy chapter');
    }

    // Lấy tổng số chapter của truyện
    const totalChapters = await Chapter.countDocuments({
      story_id: story._id,
      status: true
    });

    // Lấy chapter trước và sau
    const prevChapter = await Chapter.findOne({
      story_id: story._id,
      chapter: { $lt: chapter.chapter },
      status: true
    }).sort({ chapter: -1 });

    const nextChapter = await Chapter.findOne({
      story_id: story._id,
      chapter: { $gt: chapter.chapter },
      status: true
    }).sort({ chapter: 1 });

    // Tạo đối tượng navigation
    const navigation = {
      prev: prevChapter ? {
        id: prevChapter._id,
        chapter: prevChapter.chapter,
        name: prevChapter.name,
        slug: prevChapter.slug
      } : null,
      next: nextChapter ? {
        id: nextChapter._id,
        chapter: nextChapter.chapter,
        name: nextChapter.name,
        slug: nextChapter.slug
      } : null
    };

    return {
      success: true,
      chapter: {
        _id: chapter._id,
        chapter: chapter.chapter,
        name: chapter.name,
        content: chapter.content,
        slug: chapter.slug,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt
      },
      story: {
        id: story._id,
        name: story.name,
        slug: story.slug
      },
      navigation,
      totalChapters
    };
  }

  /**
   * Lấy danh sách chapter theo slug của truyện với access control (OPTIMIZED for large datasets)
   * @param {string} storySlug - Slug của truyện
   * @param {string} userId - ID của user (optional)
   * @param {Object} options - Pagination and optimization options
   * @returns {Promise<Object>} - Story info và danh sách chapter với access status
   * @throws {Error} - Nếu không tìm thấy truyện
   */
  async getChaptersByStorySlug(storySlug, userId = null, options = {}) {
    const {
      page = 1,
      limit = 1000, // Default limit for large stories
      projection = '_id name chapter slug isPaid price'
    } = options;

    const startTime = Date.now();

    // Tìm truyện theo slug với minimal projection
    const story = await Story.findOne({ slug: storySlug }).select('_id name slug isPaid price hasPaidChapters chapter_count');

    if (!story) {
      throw new Error('Không tìm thấy truyện');
    }

    console.log(`[ChapterService] Processing story with ${story.chapter_count || 'unknown'} chapters`);

    // PERFORMANCE: Use aggregation pipeline for large datasets
    const aggregationPipeline = [
      {
        $match: {
          story_id: story._id,
          status: true
        }
      },
      {
        $sort: { chapter: 1 }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          chapter: 1,
          slug: 1,
          isPaid: { $ifNull: ['$isPaid', false] },
          price: { $ifNull: ['$price', 0] }
        }
      }
    ];

    // Add pagination when limit is specified (not default 1000)
    if (limit < 1000) {
      const skip = (page - 1) * limit;
      aggregationPipeline.push({ $skip: skip });
      aggregationPipeline.push({ $limit: limit });
      console.log(`[ChapterService] Applying pagination: skip=${skip}, limit=${limit}`);
    }

    const chapters = await Chapter.aggregate(aggregationPipeline);

    // PERFORMANCE: Optimized user access checking
    let userPurchases = [];
    if (userId) {
      userPurchases = await this.getUserPurchasesOptimized(userId, story._id, chapters);
    }

    // HIERARCHICAL ACCESS CONTROL: Apply proper business logic
    const chaptersWithAccess = this.mapChaptersWithHierarchicalAccess(chapters, userPurchases, story._id, story);

    // Calculate total chapters for pagination
    const totalChapters = story.chapter_count || chapters.length;

    const result = {
      story: {
        _id: story._id,
        name: story.name,
        slug: story.slug,
        isPaid: story.isPaid || false,
        price: story.price || 0,
        hasPaidChapters: story.hasPaidChapters || false,
        totalChapters
      },
      chapters: chaptersWithAccess,
      // Add pagination metadata when pagination is applied
      totalChapters,
      totalPages: Math.ceil(totalChapters / limit),
      currentPage: page,
      pagination: limit < 1000 ? {
        page,
        limit,
        total: totalChapters,
        hasMore: (page * limit) < totalChapters
      } : null
    };

    const executionTime = Date.now() - startTime;
    console.log(`[ChapterService] Processed ${chapters.length} chapters for story ${storySlug} in ${executionTime}ms`);

    return result;
  }

  /**
   * Optimized user purchases fetching (without caching)
   * @param {string} userId - User ID
   * @param {ObjectId} storyId - Story ID
   * @param {Array} chapters - Chapter array for filtering
   * @returns {Promise<Array>} - User purchases
   */
  async getUserPurchasesOptimized(userId, storyId, chapters) {
    try {
      // PERFORMANCE: Use UserPurchases model for optimized purchase lookup
      const UserPurchases = require('../../models/userPurchases');

      const userPurchaseDoc = await UserPurchases.findOne({ user_id: new mongoose.Types.ObjectId(userId) });

      if (!userPurchaseDoc) {
        return [];
      }

      // Convert to flat array format for compatibility
      const userPurchases = [];

      // Add story purchases
      userPurchaseDoc.purchasedStories.forEach(purchase => {
        if (purchase.story_id.toString() === storyId.toString()) {
          userPurchases.push({
            _id: purchase._id,
            user_id: userId,
            story_id: purchase.story_id,
            createdAt: purchase.purchase_date
          });
        }
      });

      // Add chapter purchases for this story
      const chapterIds = chapters.map(c => c._id.toString());

      userPurchaseDoc.purchasedChapters.forEach((purchase) => {
        if (purchase.story_id.toString() === storyId.toString() &&
            chapterIds.includes(purchase.chapter_id.toString()) &&
            purchase.status === 'active') {
          userPurchases.push({
            _id: purchase._id,
            user_id: userId,
            chapter_id: purchase.chapter_id,
            story_id: purchase.story_id,
            createdAt: purchase.purchase_date
          });
        }
      });

      return userPurchases;
    } catch (error) {
      console.error('[ChapterService] Error fetching user purchases:', error);
      return [];
    }
  }

  /**
   * Optimized chapter access mapping
   * @param {Array} chapters - Chapters array
   * @param {Array} userPurchases - User purchases array
   * @param {ObjectId} storyId - Story ID
   * @returns {Array} - Chapters with access information
   */
  /**
   * HIERARCHICAL ACCESS CONTROL: Apply proper business logic for story/chapter purchases
   * @param {Array} chapters - List of chapters
   * @param {Array} userPurchases - User's purchase data
   * @param {string} storyId - Story ID
   * @param {Object} story - Story object with business model info
   * @returns {Array} - Chapters with access control applied
   */
  mapChaptersWithHierarchicalAccess(chapters, userPurchases, storyId, story) {
    // PERFORMANCE: Create lookup maps for O(1) access
    const storyPurchaseMap = new Map();
    const chapterPurchaseMap = new Map();

    userPurchases.forEach((purchase) => {
      // Story-level purchases (has story_id but NO chapter_id)
      if (purchase.story_id && !purchase.chapter_id) {
        storyPurchaseMap.set(purchase.story_id.toString(), purchase);
      }
      // Chapter-level purchases (has chapter_id)
      if (purchase.chapter_id) {
        chapterPurchaseMap.set(purchase.chapter_id.toString(), purchase);
      }
    });

    // Check if user has story-level purchase
    const hasStoryPurchase = storyPurchaseMap.has(storyId.toString());

    // BUSINESS LOGIC: Determine purchase model based on story configuration
    // Model A: story.isPaid = true → Buy entire story to unlock all chapters
    // Model B: story.isPaid = false + story.hasPaidChapters = true → Buy individual chapters
    // Constraint: isPaid and hasPaidChapters should NEVER both be true
    const useStoryLevelModel = story.isPaid === true; // Model A
    const useChapterLevelModel = story.isPaid === false && story.hasPaidChapters === true; // Model B

    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[HierarchicalAccess] Story: ${story.name || story.slug}`);
      console.log(`[HierarchicalAccess] story.isPaid: ${story.isPaid}, story.hasPaidChapters: ${story.hasPaidChapters}`);
      console.log(`[HierarchicalAccess] Model: ${useStoryLevelModel ? 'A (Story-level)' : useChapterLevelModel ? 'B (Chapter-level)' : 'Free'}`);
      console.log(`[HierarchicalAccess] HasStoryPurchase: ${hasStoryPurchase}`);
    }

    return chapters.map(chapter => {
      let hasAccess = true;
      let accessReason = 'free';

      if (useStoryLevelModel) {
        // MODEL A: story.isPaid = true → All chapters locked until story is purchased
        if (hasStoryPurchase) {
          hasAccess = true;
          accessReason = 'story_purchased';
        } else {
          hasAccess = false;
          accessReason = 'story_not_purchased';
        }
      } else if (useChapterLevelModel) {
        // MODEL B: story.isPaid = false + hasPaidChapters = true → Individual chapter purchases
        if (!chapter.isPaid) {
          // Free chapters in freemium model
          hasAccess = true;
          accessReason = 'free';
        } else {
          // Paid chapters in freemium model
          if (hasStoryPurchase) {
            // Story purchase takes priority even in Model B
            hasAccess = true;
            accessReason = 'story_purchased';
          } else if (chapterPurchaseMap.has(chapter._id.toString())) {
            hasAccess = true;
            accessReason = 'chapter_purchased';
          } else {
            hasAccess = false;
            accessReason = 'chapter_not_purchased';
          }
        }
      } else {
        // FREE STORY: story.isPaid = false + hasPaidChapters = false → All chapters free
        hasAccess = true;
        accessReason = 'free';
      }

      return {
        _id: chapter._id,
        name: chapter.name,
        chapter: chapter.chapter,
        slug: chapter.slug,
        isPaid: chapter.isPaid,
        price: chapter.price,
        hasAccess,
        accessReason
      };
    });
  }

  /**
   * SERVER-SIDE ACCESS CONTROL: Lấy danh sách chapter với validation access
   * @param {string} storySlug - Slug của truyện
   * @param {string|null} userId - ID của user (null nếu chưa đăng nhập)
   * @returns {Promise<Object>} - Danh sách chapter với thông tin access
   * @throws {Error} - Nếu không tìm thấy truyện
   */
  async getChaptersByStorySlugWithAccess(storySlug, userId = null) {
    // Tìm truyện theo slug
    const story = await Story.findOne({ slug: storySlug }).select('_id name slug isPaid price');

    if (!story) {
      throw new Error('Không tìm thấy truyện');
    }

    // Lấy tất cả chapter của truyện
    const chapters = await Chapter.find({
      story_id: story._id,
      status: true
    }).sort({ chapter: 1 }).select('_id name chapter slug isPaid price');

    // SERVER-SIDE ACCESS CONTROL: Validate access for each chapter
    let userPurchases = null;

    if (userId) {
      // Authenticated user: Check purchase status
      try {
        const purchaseService = require('../purchase/purchaseService');
        userPurchases = await purchaseService.getUserPurchases(userId);
        console.log(`[ChapterService] Found ${userPurchases?.stories?.length || 0} story purchases and ${userPurchases?.chapters?.length || 0} chapter purchases for user ${userId}`);
      } catch (error) {
        console.error('[ChapterService] Error getting user purchases:', error);
        // Continue with null purchases (treat as no purchases)
      }
    }

    // Apply hierarchical access control to each chapter
    const chaptersWithAccess = chapters.map(chapter => {
      let hasAccess = false;
      let accessReason = 'no_access';

      if (!userId) {
        // Unauthenticated user
        if (!story.isPaid && !chapter.isPaid) {
          hasAccess = true;
          accessReason = 'free_content';
        } else {
          hasAccess = false;
          accessReason = 'authentication_required';
        }
      } else {
        // Authenticated user: Apply hierarchical permission system
        if (story.isPaid) {
          // Story-level paid content
          const hasStoryAccess = userPurchases?.stories?.some(purchase =>
            purchase.storyId.toString() === story._id.toString()
          ) || false;

          hasAccess = hasStoryAccess;
          accessReason = hasStoryAccess ? 'story_purchased' : 'story_not_purchased';
        } else {
          // Free story: check individual chapter access
          if (chapter.isPaid) {
            // Paid chapter in free story (freemium model)
            const hasChapterAccess = userPurchases?.chapters?.some(purchase =>
              purchase.chapterId.toString() === chapter._id.toString()
            ) || false;

            hasAccess = hasChapterAccess;
            accessReason = hasChapterAccess ? 'chapter_purchased' : 'chapter_not_purchased';
          } else {
            // Free chapter in free story
            hasAccess = true;
            accessReason = 'free_content';
          }
        }
      }

      return {
        _id: chapter._id,
        name: chapter.name,
        chapter: chapter.chapter,
        slug: chapter.slug,
        isPaid: chapter.isPaid || false,
        price: chapter.price || 0,
        // SERVER-SIDE ACCESS CONTROL: Include access status in response
        hasAccess,
        accessReason
      };
    });

    return {
      story: {
        _id: story._id,
        name: story.name,
        slug: story.slug,
        isPaid: story.isPaid || false,
        price: story.price || 0
      },
      chapters: chaptersWithAccess
    };
  }

  /**
   * Lấy danh sách chapter có phân trang và lọc
   * @param {Object} options - Các tùy chọn
   * @returns {Promise<Object>} - Chapters và thông tin phân trang
   */
  async getChapters(options) {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      search = '',
      status,
      is_new,
      story_id,
      audio_show,
      show_ads,
      count_by_story = false
    } = options;

    // Nếu yêu cầu đếm số lượng chapter theo truyện
    if (count_by_story === true || count_by_story === 'true') {
      // Đếm số lượng chapter theo story_id
      const chapterCounts = await Chapter.aggregate([
        { $group: { _id: "$story_id", count: { $sum: 1 } } }
      ]);

      // Chuyển đổi ObjectId thành string để dễ so sánh
      const formattedChapterCounts = chapterCounts.map(item => {
        const storyIdStr = item._id ? item._id.toString() : '';
        return {
          _id: storyIdStr,
          count: item.count
        };
      });

      // Lấy chapter mới nhất của mỗi truyện
      const latestChapters = await Chapter.aggregate([
        {
          $sort: { chapter: -1 } // Sắp xếp theo số chapter giảm dần
        },
        {
          $group: {
            _id: "$story_id",
            story_id: { $first: "$story_id" },
            chapter: { $first: "$chapter" },
            name: { $first: "$name" },
            slug: { $first: "$slug" },
            createdAt: { $first: "$createdAt" }
          }
        }
      ]);

      // Chuyển đổi ObjectId thành string để dễ so sánh
      const formattedLatestChapters = latestChapters.map(item => {
        const storyIdStr = item.story_id ? item.story_id.toString() : '';
        const itemIdStr = item._id ? item._id.toString() : '';
        return {
          ...item,
          _id: itemIdStr,
          story_id: storyIdStr
        };
      });

      return {
        chapterCounts: formattedChapterCounts,
        latestChapters: formattedLatestChapters
      };
    }

    // Xây dựng query
    const query = {};

    // Tìm kiếm theo tên hoặc slug
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    // Lọc theo trạng thái
    if (status !== undefined) {
      query.status = status === 'true' || status === true;
    }

    // Lọc theo cờ is_new
    if (is_new !== undefined) {
      query.is_new = is_new === 'true' || is_new === true;
    }

    // Lọc theo cờ audio_show
    if (audio_show !== undefined) {
      query.audio_show = audio_show === 'true' || audio_show === true;
    }

    // Lọc theo cờ show_ads
    if (show_ads !== undefined) {
      query.show_ads = show_ads === 'true' || show_ads === true;
    }

    // Lọc theo truyện
    if (story_id) {
      if (!mongoose.Types.ObjectId.isValid(story_id)) {
        throw new Error('ID truyện không hợp lệ');
      }

      query.story_id = new mongoose.Types.ObjectId(story_id);
    }

    // Thực hiện truy vấn với phân trang
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skipNumber = (pageNumber - 1) * limitNumber;

    const [chapters, total] = await Promise.all([
      Chapter.find(query)
        .populate('story_id', 'name slug')
        .sort(sort)
        .skip(skipNumber)
        .limit(limitNumber),
      Chapter.countDocuments(query)
    ]);

    return {
      chapters,
      pagination: {
        total,
        totalPages: Math.ceil(total / limitNumber),
        currentPage: pageNumber,
        limit: limitNumber
      }
    };
  }

  /**
   * Chuyển đổi trạng thái chapter
   * @param {string} id - ID của chapter
   * @returns {Promise<Object>} - Chapter với trạng thái mới
   */
  async toggleStatus(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('ID chapter không hợp lệ');
    }

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      throw new Error('Không tìm thấy chapter');
    }

    chapter.status = !chapter.status;
    await chapter.save();

    return {
      chapter,
      status: chapter.status
    };
  }

  /**
   * Chuyển đổi cờ (is_new, audio_show, show_ads)
   * @param {string} id - ID của chapter
   * @param {string} flag - Tên cờ cần chuyển đổi
   * @returns {Promise<Object>} - Chapter với cờ mới
   */
  async toggleFlag(id, flag) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('ID chapter không hợp lệ');
    }

    const validFlags = ['is_new', 'audio_show', 'show_ads'];
    if (!flag || !validFlags.includes(flag)) {
      throw new Error('Flag không hợp lệ');
    }

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      throw new Error('Không tìm thấy chapter');
    }

    chapter[flag] = !chapter[flag];
    await chapter.save();

    return {
      chapter,
      flag,
      value: chapter[flag]
    };
  }

  /**
   * Lấy số chương tiếp theo của một truyện
   * @param {string} storyId - ID của truyện
   * @returns {Promise<number>} - Số chương tiếp theo
   */
  async getNextChapterNumber(storyId) {
    try {
      // Kiểm tra storyId có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        throw new Error('ID truyện không hợp lệ');
      }

      // Tìm chapter có số chương lớn nhất của truyện
      const latestChapter = await Chapter.findOne({ story_id: storyId })
        .sort({ chapter: -1 })
        .limit(1);

      // Nếu không có chapter nào, trả về 1
      if (!latestChapter) {
        return 1;
      }

      // Trả về số chương tiếp theo
      return latestChapter.chapter + 1;
    } catch (error) {
      console.error(`[Service] Error in getNextChapterNumber: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lấy danh sách chapter theo truyện
   * @param {string} storyId - ID của truyện
   * @param {Object} options - Tùy chọn
   * @returns {Promise<Object>} - Danh sách chapter và thông tin truyện
   */
  async getChaptersByStory(storyId, options = {}) {
    try {
      const { excludeContent = false } = options;

      // Kiểm tra storyId có hợp lệ không
      if (!storyId || typeof storyId !== 'string') {
        console.error(`[Service] ID truyện không hợp lệ: ${storyId}`);
        throw new Error('ID truyện không hợp lệ');
      }

      // Kiểm tra storyId có phải là ObjectId hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        console.error(`[Service] ID truyện không phải là ObjectId hợp lệ: ${storyId}`);
        throw new Error('ID truyện không hợp lệ');
      }

      // Kiểm tra truyện tồn tại
      const story = await Story.findById(storyId);
      if (!story) {
        console.error(`[Service] Không tìm thấy truyện với ID: ${storyId}`);
        throw new Error('Không tìm thấy truyện');
      }

      // Tạo ObjectId từ storyId
      const storyObjectId = new mongoose.Types.ObjectId(storyId);

      // Xây dựng query với select fields
      let query = Chapter.find({ story_id: storyObjectId });

      // Nếu excludeContent = true, loại bỏ trường content
      if (excludeContent) {
        query = query.select('-content');
        console.log(`[Service] Loại bỏ trường content cho story ID: ${storyId}`);
      }

      // Lấy tất cả chapter của truyện
      const chapters = await query
        .sort({ chapter: 1 }) // Sắp xếp theo số chương tăng dần
        .lean();

      console.log(`[Service] Lấy được ${chapters.length} chapters cho story ID: ${storyId}, excludeContent: ${excludeContent}`);

      return {
        story,
        chapters,
        total: chapters.length
      };
    } catch (error) {
      console.error(`[Service] Lỗi khi lấy danh sách chapter theo story ID: ${storyId}`, error);
      throw error;
    }
  }

  /**
   * Lấy danh sách chapter theo truyện với pagination và search
   * @param {string} storyId - ID của truyện
   * @param {Object} options - Tùy chọn pagination và search
   * @returns {Promise<Object>} - Danh sách chapter với pagination metadata
   */
  async getChaptersByStoryWithPagination(storyId, options = {}) {
    try {
      const {
        page = 1,
        limit = 100,
        search = '',
        sort = 'chapter',
        excludeContent = false
      } = options;

      // Kiểm tra storyId có hợp lệ không
      if (!storyId || typeof storyId !== 'string') {
        console.error(`[Service] ID truyện không hợp lệ: ${storyId}`);
        throw new Error('ID truyện không hợp lệ');
      }

      // Kiểm tra storyId có phải là ObjectId hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        console.error(`[Service] ID truyện không phải là ObjectId hợp lệ: ${storyId}`);
        throw new Error('ID truyện không hợp lệ');
      }

      // Kiểm tra truyện tồn tại
      const story = await Story.findById(storyId);
      if (!story) {
        console.error(`[Service] Không tìm thấy truyện với ID: ${storyId}`);
        throw new Error('Không tìm thấy truyện');
      }

      // Tạo ObjectId từ storyId
      const storyObjectId = new mongoose.Types.ObjectId(storyId);

      // Xây dựng query filter
      const query = { story_id: storyObjectId };

      // Thêm search filter nếu có - search toàn bộ chapters của story
      if (search && search.trim()) {
        const searchTerm = search.trim();
        const searchNumber = parseInt(searchTerm);

        // Tạo query OR để tìm kiếm linh hoạt hơn
        const searchQuery = [];

        // Nếu search là số, tìm theo chapter number
        if (!isNaN(searchNumber)) {
          searchQuery.push({ chapter: searchNumber });
        }

        // Luôn tìm theo tên chapter (case-insensitive)
        searchQuery.push({ name: { $regex: searchTerm, $options: 'i' } });

        // Nếu search term chứa "chapter" hoặc "chương", tìm theo pattern
        if (searchTerm.toLowerCase().includes('chapter') || searchTerm.toLowerCase().includes('chương')) {
          const numberMatch = searchTerm.match(/\d+/);
          if (numberMatch) {
            searchQuery.push({ chapter: parseInt(numberMatch[0]) });
          }
        }

        // Áp dụng OR query
        query.$or = searchQuery;
      }

      // Xây dựng sort object
      let sortObject = {};
      if (sort === 'chapter') {
        sortObject = { chapter: 1 };
      } else if (sort === '-chapter') {
        sortObject = { chapter: -1 };
      } else if (sort === 'name') {
        sortObject = { name: 1 };
      } else if (sort === '-name') {
        sortObject = { name: -1 };
      } else if (sort === 'createdAt') {
        sortObject = { createdAt: 1 };
      } else if (sort === '-createdAt') {
        sortObject = { createdAt: -1 };
      } else {
        sortObject = { chapter: 1 }; // Default sort
      }

      // Tính toán pagination
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skipNumber = (pageNumber - 1) * limitNumber;

      // Xây dựng query với select fields
      let chapterQuery = Chapter.find(query);

      // Nếu excludeContent = true, loại bỏ trường content
      if (excludeContent) {
        chapterQuery = chapterQuery.select('-content');
        console.log(`[Service] Loại bỏ trường content cho pagination, story ID: ${storyId}`);
      }

      // Thực hiện query với pagination
      const [chapters, totalItems] = await Promise.all([
        chapterQuery
          .sort(sortObject)
          .skip(skipNumber)
          .limit(limitNumber)
          .lean(),
        Chapter.countDocuments(query)
      ]);

      // Tính toán pagination metadata
      const totalPages = Math.ceil(totalItems / limitNumber);
      const hasNext = pageNumber < totalPages;
      const hasPrevious = pageNumber > 1;

      console.log(`[Service] Tìm thấy ${chapters.length}/${totalItems} chapter cho story ID: ${storyId}, page: ${pageNumber}/${totalPages}`);

      return {
        chapters,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          limit: limitNumber,
          hasNext,
          hasPrevious
        }
      };
    } catch (error) {
      console.error(`[Service] Lỗi khi lấy danh sách chapter với pagination cho story ID: ${storyId}`, error);
      throw error;
    }
  }

  /**
   * Lấy danh sách truyện cho dropdown
   * @returns {Promise<Array>} - Danh sách truyện
   */
  async getStoriesForDropdown() {
    // Lấy danh sách truyện với các trường cần thiết
    const stories = await Story.find({}, 'name slug')
      .sort({ name: 1 }) // Sắp xếp theo tên
      .lean();

    return stories;
  }
}

module.exports = new ChapterService();