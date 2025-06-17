/**
 * Định nghĩa các static methods cho StoriesReading model
 * @param {Object} schema - Schema của StoriesReading
 */
module.exports = function(schema) {
  /**
   * Tìm lịch sử đọc theo user_id và story_id
   */
  schema.statics.findByUserAndStory = function(userId, storyId) {
    return this.findOne({
      user_id: userId,
      story_id: storyId
    })
    .populate({
      path: 'story_id',
      select: 'name slug image status author_id categories',
      populate: [
        {
          path: 'author_id',
          select: 'name slug'
        },
        {
          path: 'categories',
          select: 'name slug'
        }
      ]
    })
    .populate('current_chapter.chapter_id', 'name chapter_number slug')
    .populate('last_completed_chapter.chapter_id', 'name chapter_number slug');
  };

  /**
   * Lấy danh sách lịch sử đọc của người dùng với filtering và enhanced data
   */
  schema.statics.findByUser = async function(userId, options = {}) {
    const {
      status,
      limit = 10,
      skip = 0,
      sort = { 'reading_stats.last_read_at': -1 },
      includeCompleted = true
    } = options;

    const mongoose = require('mongoose');
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Build match query
    const matchQuery = { user_id: userObjectId };
    if (status) {
      matchQuery.reading_status = status;
    } else if (!includeCompleted) {
      matchQuery.reading_status = { $ne: 'completed' };
    }

    const pipeline = [
      { $match: matchQuery },

      // Lookup story information
      {
        $lookup: {
          from: 'stories',
          localField: 'story_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      { $unwind: '$story' },

      // Lookup authors (optimized - only essential fields)
      {
        $lookup: {
          from: 'authors',
          localField: 'story.author_id',
          foreignField: '_id',
          as: 'story.author_id',
          pipeline: [
            {
              $project: {
                _id: 1,
                slug: 1,
                name: 1
                // Excluded: status, createdAt, updatedAt, __v
              }
            }
          ]
        }
      },

      // Lookup categories (optimized - only essential fields)
      {
        $lookup: {
          from: 'categories',
          localField: 'story.categories',
          foreignField: '_id',
          as: 'story.categories',
          pipeline: [
            {
              $project: {
                _id: 1,
                slug: 1,
                name: 1
                // Excluded: status, createdAt, updatedAt, __v
              }
            }
          ]
        }
      },

      // Lookup current chapter (optimized - only essential fields)
      {
        $lookup: {
          from: 'chapters',
          localField: 'current_chapter.chapter_id',
          foreignField: '_id',
          as: 'current_chapter_data',
          pipeline: [
            {
              $project: {
                _id: 1,
                story_id: 1,
                chapter: 1,
                name: 1,
                slug: 1
                // Excluded: content, audio, audio_show, show_ads, link_ref, pass_code, is_new, status, createdAt, updatedAt, __v
              }
            }
          ]
        }
      },

      // Lookup last completed chapter (optimized - only essential fields)
      {
        $lookup: {
          from: 'chapters',
          localField: 'last_completed_chapter.chapter_id',
          foreignField: '_id',
          as: 'last_completed_chapter_data',
          pipeline: [
            {
              $project: {
                _id: 1,
                story_id: 1,
                chapter: 1,
                name: 1,
                slug: 1
                // Excluded: content, audio, audio_show, show_ads, link_ref, pass_code, is_new, status, createdAt, updatedAt, __v
              }
            }
          ]
        }
      },

      // Count total chapters for the story
      {
        $lookup: {
          from: 'chapters',
          let: { storyId: '$story._id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$story_id', '$$storyId'] } } },
            { $count: 'total' }
          ],
          as: 'chapter_count_data'
        }
      },

      // Project enhanced data structure
      {
        $addFields: {
          story_id: {
            _id: '$story._id',
            name: '$story.name',
            slug: '$story.slug',
            image: '$story.image',
            status: '$story.status',
            author_id: '$story.author_id',
            categories: '$story.categories'
          },
          'current_chapter.chapter_id': {
            $arrayElemAt: ['$current_chapter_data', 0]
          },
          'last_completed_chapter.chapter_id': {
            $arrayElemAt: ['$last_completed_chapter_data', 0]
          },
          total_chapters: {
            $ifNull: [
              { $arrayElemAt: ['$chapter_count_data.total', 0] },
              0
            ]
          },
          // Enhanced computed fields
          progress_percentage: {
            $cond: {
              if: { $gt: [{ $arrayElemAt: ['$chapter_count_data.total', 0] }, 0] },
              then: {
                $round: [
                  {
                    $multiply: [
                      {
                        $divide: [
                          '$reading_stats.completed_chapters',
                          { $arrayElemAt: ['$chapter_count_data.total', 0] }
                        ]
                      },
                      100
                    ]
                  },
                  1
                ]
              },
              else: 0
            }
          },
          is_up_to_date: {
            $eq: [
              '$current_chapter.chapter_number',
              { $arrayElemAt: ['$chapter_count_data.total', 0] }
            ]
          },
          bookmark_count: { $size: { $ifNull: ['$bookmarks', []] } },
          reading_status_display: {
            $switch: {
              branches: [
                { case: { $eq: ['$reading_status', 'reading'] }, then: 'Đang đọc' },
                { case: { $eq: ['$reading_status', 'completed'] }, then: 'Hoàn thành' },
                { case: { $eq: ['$reading_status', 'paused'] }, then: 'Tạm dừng' },
                { case: { $eq: ['$reading_status', 'dropped'] }, then: 'Đã bỏ' },
                { case: { $eq: ['$reading_status', 'plan_to_read'] }, then: 'Dự định đọc' }
              ],
              default: 'Không rõ'
            }
          },
          formatted_reading_time: {
            $let: {
              vars: {
                totalSeconds: '$reading_stats.total_reading_time',
                hours: { $floor: { $divide: ['$reading_stats.total_reading_time', 3600] } },
                minutes: { $floor: { $divide: [{ $mod: ['$reading_stats.total_reading_time', 3600] }, 60] } }
              },
              in: {
                $cond: {
                  if: { $gte: ['$$hours', 1] },
                  then: { $concat: [{ $toString: '$$hours' }, 'h ', { $toString: '$$minutes' }, 'm'] },
                  else: { $concat: [{ $toString: '$$minutes' }, ' phút'] }
                }
              }
            }
          },
          priority_display: {
            $switch: {
              branches: [
                { case: { $eq: ['$metadata.priority', 1] }, then: 'Thấp' },
                { case: { $eq: ['$metadata.priority', 2] }, then: 'Thấp' },
                { case: { $eq: ['$metadata.priority', 3] }, then: 'Trung bình' },
                { case: { $eq: ['$metadata.priority', 4] }, then: 'Cao' },
                { case: { $eq: ['$metadata.priority', 5] }, then: 'Rất cao' }
              ],
              default: 'Trung bình'
            }
          },
          last_activity: '$reading_stats.last_read_at'
        }
      },

      // Remove temporary fields and optimize final structure
      {
        $project: {
          // Essential fields only
          _id: 1,
          user_id: 1,
          story_id: 1,
          current_chapter: 1,
          last_completed_chapter: 1,
          reading_status: 1,
          reading_stats: 1,
          bookmarks: 1,
          personal_notes: 1,
          metadata: 1,
          createdAt: 1,
          updatedAt: 1,
          // Enhanced computed fields
          total_chapters: 1,
          progress_percentage: 1,
          is_up_to_date: 1,
          bookmark_count: 1,
          reading_status_display: 1,
          formatted_reading_time: 1,
          priority_display: 1,
          last_activity: 1
          // Excluded: __v, story, current_chapter_data, last_completed_chapter_data, chapter_count_data
        }
      },

      // Sort
      { $sort: sort },

      // Pagination
      { $skip: skip },
      { $limit: limit }
    ];

    return this.aggregate(pipeline);
  };

  /**
   * Cập nhật hoặc tạo mới lịch sử đọc (upsert pattern)
   * Đã tối ưu hóa để loại bỏ reading_position và sử dụng readingTime tính bằng giây
   */
  schema.statics.upsertReading = async function(userId, storyId, chapterData, options = {}) {
    const {
      chapterId,
      chapterNumber,
      readingTime = 0, // Thời gian đọc tính bằng giây
      markCompleted = false,
      status = 'reading' // Trạng thái: 'reading' hoặc 'completed'
    } = chapterData;

    try {
      // Tách logic thành hai operations riêng biệt để tránh conflict hoàn toàn
      // Bước 1: Kiểm tra xem document đã tồn tại chưa
      const existingDoc = await this.findOne({ user_id: userId, story_id: storyId });

      if (existingDoc) {
        // Document đã tồn tại - chỉ update

      const updateOps = {
        $set: {
          'current_chapter.chapter_id': chapterId,
          'current_chapter.chapter_number': chapterNumber,
          'reading_stats.last_read_at': new Date()
        },
        $inc: {
          'reading_stats.visit_count': 1,
          'reading_stats.total_reading_time': readingTime
        }
      };

      // Xử lý reading_status cho document đã tồn tại
      if (markCompleted || status === 'completed') {
        updateOps.$set['last_completed_chapter.chapter_id'] = chapterId;
        updateOps.$set['last_completed_chapter.chapter_number'] = chapterNumber;
        updateOps.$set['last_completed_chapter.completed_at'] = new Date();
        updateOps.$inc['reading_stats.completed_chapters'] = 1;
        updateOps.$set['reading_status'] = 'completed';
      }
        // Không set reading_status = 'reading' cho document đã tồn tại để tránh override 'completed'

        try {
          const result = await this.findOneAndUpdate(
            { user_id: userId, story_id: storyId },
            updateOps,
            { new: true, runValidators: true }
          );

          return result;

        } catch (error) {
          throw error;
        }

      } else {
        // Document chưa tồn tại - tạo mới
        const newDoc = {
          user_id: userId,
          story_id: storyId,
          current_chapter: {
            chapter_id: chapterId,
            chapter_number: chapterNumber
          },
          reading_stats: {
            first_read_at: new Date(),
            last_read_at: new Date(),
            visit_count: 1,
            total_reading_time: readingTime,
            completed_chapters: markCompleted || status === 'completed' ? 1 : 0
          },
          reading_status: markCompleted || status === 'completed' ? 'completed' : 'reading'
        };

        // Thêm completed chapter info nếu cần
        if (markCompleted || status === 'completed') {
          newDoc.last_completed_chapter = {
            chapter_id: chapterId,
            chapter_number: chapterNumber,
            completed_at: new Date()
          };
        }

        try {
          const result = await this.create(newDoc);
          return result;

        } catch (error) {
          throw error;
        }
      }

    } catch (globalError) {
      // Provide specific error messages based on error type
      if (globalError.code === 40 || globalError.message.includes('conflict')) {
        throw new Error(`MongoDB conflict error resolved with new approach. Original error: ${globalError.message}`);
      } else if (globalError.code === 11000) {
        throw new Error(`Duplicate key error: Document may already exist. Original error: ${globalError.message}`);
      } else {
        throw new Error(`Database operation failed: ${globalError.message}`);
      }
    }
  };

  /**
   * Cập nhật trạng thái đọc
   */
  schema.statics.updateReadingStatus = async function(userId, storyId, status) {
    const validStatuses = ['reading', 'completed', 'paused', 'dropped', 'plan_to_read'];

    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid reading status: ${status}`);
    }

    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      {
        reading_status: status,
        'reading_stats.last_read_at': new Date()
      },
      { new: true }
    );
  };

  /**
   * Xóa toàn bộ lịch sử đọc của user cho một story (bao gồm tất cả bookmarks)
   */
  schema.statics.deleteUserStoryReading = async function(userId, storyId) {
    try {
      const mongoose = require('mongoose');
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const storyObjectId = typeof storyId === 'string' ? new mongoose.Types.ObjectId(storyId) : storyId;

      // Tìm và xóa reading record
      const deletedRecord = await this.findOneAndDelete({
        user_id: userObjectId,
        story_id: storyObjectId
      });

      if (!deletedRecord) {
        throw new Error('Không tìm thấy lịch sử đọc để xóa');
      }

      // Trả về thông tin về record đã xóa
      return {
        success: true,
        message: 'Đã xóa lịch sử đọc và tất cả bookmarks thành công',
        deletedRecord: {
          _id: deletedRecord._id,
          story_id: deletedRecord.story_id,
          reading_status: deletedRecord.reading_status,
          bookmarks_count: deletedRecord.bookmarks ? deletedRecord.bookmarks.length : 0,
          reading_stats: deletedRecord.reading_stats
        }
      };
    } catch (error) {
      console.error('Error deleting user story reading:', error);
      throw new Error(`Không thể xóa lịch sử đọc: ${error.message}`);
    }
  };

  /**
   * Thêm bookmark
   */
  schema.statics.addBookmark = async function(userId, storyId, bookmarkData) {
    const { chapterId, chapterNumber, position = 0, note = '' } = bookmarkData;

    const bookmark = {
      chapter_id: chapterId,
      chapter_number: chapterNumber,
      position,
      note: note.substring(0, 200), // Giới hạn độ dài note
      created_at: new Date()
    };

    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      {
        $push: {
          bookmarks: {
            $each: [bookmark],
            $sort: { created_at: -1 },
            $slice: 10 // Giữ tối đa 10 bookmarks
          }
        }
      },
      { new: true }
    );
  };

  /**
   * Xóa bookmark
   */
  schema.statics.removeBookmark = async function(userId, storyId, bookmarkId) {
    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      { $pull: { bookmarks: { _id: bookmarkId } } },
      { new: true }
    );
  };

  /**
   * Lấy tất cả bookmarks của user từ tất cả stories với thông tin đầy đủ
   */
  schema.statics.getAllUserBookmarks = async function(userId, options = {}) {
    const { limit = 50, skip = 0, sort = 'created_at' } = options;

    try {
      // Convert userId to ObjectId if it's a string
      const mongoose = require('mongoose');
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      // If no records, return early
      const userRecords = await this.find({ user_id: userObjectId });
      if (userRecords.length === 0) {
        return {
          bookmarks: [],
          total: 0,
          totalPages: 0,
          currentPage: 1
        };
      }

      // Sử dụng aggregation pipeline để lấy tất cả bookmarks với thông tin đầy đủ
      const pipeline = [
        // Match user's reading records
        { $match: { user_id: userObjectId } },

        // Unwind bookmarks array
        { $unwind: '$bookmarks' },

        // Lookup story information
        {
          $lookup: {
            from: 'stories',
            localField: 'story_id',
            foreignField: '_id',
            as: 'story'
          }
        },
        { $unwind: '$story' },

        // Lookup chapter information (optimized - only essential fields)
        {
          $lookup: {
            from: 'chapters',
            localField: 'bookmarks.chapter_id',
            foreignField: '_id',
            as: 'chapter',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  name: 1,
                  slug: 1,
                  chapter: 1
                  // Excluded: content, audio, audio_show, show_ads, link_ref, pass_code, is_new, status, createdAt, updatedAt, __v
                }
              }
            ]
          }
        },
        { $unwind: '$chapter' },

        // Lookup authors (optimized - only essential fields)
        {
          $lookup: {
            from: 'authors',
            localField: 'story.author_id',
            foreignField: '_id',
            as: 'story.author_id',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  slug: 1,
                  name: 1
                  // Excluded: status, createdAt, updatedAt, __v
                }
              }
            ]
          }
        },

        // Lookup categories (optimized - only essential fields)
        {
          $lookup: {
            from: 'categories',
            localField: 'story.categories',
            foreignField: '_id',
            as: 'story.categories',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  slug: 1,
                  name: 1
                  // Excluded: status, createdAt, updatedAt, __v
                }
              }
            ]
          }
        },

        // Project the final structure (optimized)
        {
          $project: {
            _id: '$bookmarks._id',
            bookmark_id: '$bookmarks._id',
            story_id: '$story_id',
            chapter_id: '$bookmarks.chapter_id',
            chapter_number: '$bookmarks.chapter_number',
            position: '$bookmarks.position',
            note: '$bookmarks.note',
            created_at: '$bookmarks.created_at',
            story: {
              _id: '$story._id',
              name: '$story.name',
              slug: '$story.slug',
              image: '$story.image',
              status: '$story.status',
              author_id: '$story.author_id', // Use optimized author_id instead of authors
              categories: '$story.categories'
            },
            chapter: {
              _id: '$chapter._id',
              name: '$chapter.name',
              slug: '$chapter.slug',
              chapter: '$chapter.chapter'
            }
            // Excluded: reading_stats (not needed for bookmark display)
          }
        },

        // Sort bookmarks
        { $sort: sort === 'created_at' ? { created_at: -1 } : { 'story.name': 1 } },

        // Pagination
        { $skip: skip },
        { $limit: limit }
      ];

      const bookmarks = await this.aggregate(pipeline);

      // Get total count for pagination
      const countPipeline = [
        { $match: { user_id: userObjectId } },
        { $unwind: '$bookmarks' },
        { $count: 'total' }
      ];

      const countResult = await this.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;

      return {
        bookmarks,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(skip / limit) + 1
      };
    } catch (error) {
      console.error('Error in getAllUserBookmarks:', error);
      throw error;
    }
  };

  /**
   * Cập nhật ghi chú cá nhân
   */
  schema.statics.updatePersonalNotes = async function(userId, storyId, notes) {
    return this.findOneAndUpdate(
      { user_id: userId, story_id: storyId },
      {
        personal_notes: notes.substring(0, 1000), // Giới hạn độ dài
        'reading_stats.last_read_at': new Date()
      },
      { new: true }
    );
  };

  /**
   * Lấy thống kê đọc của user
   */
  schema.statics.getUserReadingStats = async function(userId) {
    const pipeline = [
      { $match: { user_id: userId } },
      {
        $group: {
          _id: '$reading_status',
          count: { $sum: 1 },
          total_reading_time: { $sum: '$reading_stats.total_reading_time' },
          total_chapters: { $sum: '$reading_stats.completed_chapters' }
        }
      }
    ];

    const stats = await this.aggregate(pipeline);

    // Format kết quả
    const result = {
      reading: 0,
      completed: 0,
      paused: 0,
      dropped: 0,
      plan_to_read: 0,
      total_stories: 0,
      total_reading_time: 0,
      total_chapters_read: 0
    };

    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total_stories += stat.count;
      result.total_reading_time += stat.total_reading_time;
      result.total_chapters_read += stat.total_chapters;
    });

    return result;
  };

  /**
   * Lấy danh sách truyện đang đọc gần đây
   */
  schema.statics.getRecentlyRead = async function(userId, limit = 5) {
    return this.find({
      user_id: userId,
      reading_status: { $in: ['reading', 'paused'] }
    })
    .sort({ 'reading_stats.last_read_at': -1 })
    .limit(limit)
    .populate({
      path: 'story_id',
      select: 'name slug image author_id categories',
      populate: [
        {
          path: 'author_id',
          select: 'name slug'
        },
        {
          path: 'categories',
          select: 'name slug'
        }
      ]
    })
    .populate('current_chapter.chapter_id', 'name chapter_number');
  };

  /**
   * Tìm kiếm trong lịch sử đọc
   */
  schema.statics.searchReadingHistory = async function(userId, searchTerm, options = {}) {
    const { limit = 10, skip = 0, status } = options;

    const pipeline = [
      { $match: { user_id: userId } },
      {
        $lookup: {
          from: 'stories',
          localField: 'story_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      { $unwind: '$story' },

      // Lookup authors (optimized - only essential fields)
      {
        $lookup: {
          from: 'authors',
          localField: 'story.author_id',
          foreignField: '_id',
          as: 'story.author_id',
          pipeline: [
            {
              $project: {
                _id: 1,
                slug: 1,
                name: 1
                // Excluded: status, createdAt, updatedAt, __v
              }
            }
          ]
        }
      },

      // Lookup categories (optimized - only essential fields)
      {
        $lookup: {
          from: 'categories',
          localField: 'story.categories',
          foreignField: '_id',
          as: 'story.categories',
          pipeline: [
            {
              $project: {
                _id: 1,
                slug: 1,
                name: 1
                // Excluded: status, createdAt, updatedAt, __v
              }
            }
          ]
        }
      },

      {
        $match: {
          $or: [
            { 'story.name': { $regex: searchTerm, $options: 'i' } },
            { 'personal_notes': { $regex: searchTerm, $options: 'i' } },
            { 'metadata.personal_tags': { $regex: searchTerm, $options: 'i' } },
            { 'story.author_id.name': { $regex: searchTerm, $options: 'i' } },
            { 'story.categories.name': { $regex: searchTerm, $options: 'i' } }
          ]
        }
      }
    ];

    if (status) {
      pipeline.push({ $match: { reading_status: status } });
    }

    pipeline.push(
      // Lookup current chapter (optimized - only essential fields)
      {
        $lookup: {
          from: 'chapters',
          localField: 'current_chapter.chapter_id',
          foreignField: '_id',
          as: 'current_chapter_data',
          pipeline: [
            {
              $project: {
                _id: 1,
                story_id: 1,
                chapter: 1,
                name: 1,
                slug: 1
                // Excluded: content, audio, audio_show, show_ads, link_ref, pass_code, is_new, status, createdAt, updatedAt, __v
              }
            }
          ]
        }
      },

      // Project the final structure
      {
        $addFields: {
          'current_chapter.chapter_id': {
            $arrayElemAt: ['$current_chapter_data', 0]
          },
          story_id: '$story'
        }
      },

      // Remove temporary fields
      {
        $unset: ['story', 'current_chapter_data']
      },

      { $sort: { 'reading_stats.last_read_at': -1 } },
      { $skip: skip },
      { $limit: limit }
    );

    return this.aggregate(pipeline);
  };

  /**
   * Cleanup orphaned records (khi story hoặc chapter bị xóa)
   */
  schema.statics.cleanupOrphanedRecords = async function() {
    const pipeline = [
      {
        $lookup: {
          from: 'stories',
          localField: 'story_id',
          foreignField: '_id',
          as: 'story_exists'
        }
      },
      {
        $match: {
          story_exists: { $size: 0 }
        }
      }
    ];

    const orphanedRecords = await this.aggregate(pipeline);

    if (orphanedRecords.length > 0) {
      const orphanedIds = orphanedRecords.map(record => record._id);
      await this.deleteMany({ _id: { $in: orphanedIds } });

      return {
        cleaned: orphanedRecords.length,
        message: `Cleaned up ${orphanedRecords.length} orphaned reading records`
      };
    }

    return {
      cleaned: 0,
      message: 'No orphaned records found'
    };
  };
};