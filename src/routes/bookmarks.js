const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth.middleware');
const logRequest = require('../middleware/requestLogger');

// Apply request logging middleware
router.use(logRequest);

/**
 * CRITICAL FIX: Add missing bookmark check route
 * Route: GET /api/bookmarks/check/:userId/:storyId/:chapterId
 * Description: Check if a specific chapter is bookmarked by user
 */
router.get('/check/:userId/:storyId/:chapterId', optionalAuth, async (req, res) => {
  try {
    const { userId, storyId, chapterId } = req.params;
    
    console.log('[BookmarkCheck] Checking bookmark:', { userId, storyId, chapterId });

    // Import the storiesReading model to check bookmarks
    const StoriesReading = require('../models/storiesReading');
    
    // Find the reading record for this user and story
    const readingRecord = await StoriesReading.findOne({
      user_id: userId,
      story_id: storyId
    });

    if (!readingRecord || !readingRecord.bookmarks) {
      return res.json({
        success: true,
        isBookmarked: false,
        message: 'No bookmark found'
      });
    }

    // Check if this chapter is bookmarked
    const isBookmarked = readingRecord.bookmarks.some(
      bookmark => bookmark.chapter_id && bookmark.chapter_id.toString() === chapterId
    );

    console.log('[BookmarkCheck] Result:', { isBookmarked });

    res.json({
      success: true,
      isBookmarked,
      message: isBookmarked ? 'Đã Lưu Bookmark' : 'Chưa Lưu Bookmark'
    });

  } catch (error) {
    console.error('[BookmarkCheck] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to check bookmark status'
    });
  }
});

/**
 * Route: GET /api/bookmarks/:userId
 * Description: Get all bookmarks for a user (for compatibility)
 */
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    console.log('[BookmarkList] Getting bookmarks for user:', userId);

    // Import the storiesReading model
    const StoriesReading = require('../models/storiesReading');
    
    // Get all reading records with bookmarks for this user
    const readingRecords = await StoriesReading.find({
      user_id: userId,
      bookmarks: { $exists: true, $not: { $size: 0 } }
    })
    .populate('story_id', 'name slug image')
    .populate('bookmarks.chapter_id', 'name slug chapter')
    .sort({ 'bookmarks.created_at': -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

    // Flatten bookmarks from all stories
    const allBookmarks = [];
    readingRecords.forEach(record => {
      if (record.bookmarks) {
        record.bookmarks.forEach(bookmark => {
          allBookmarks.push({
            _id: bookmark._id,
            story: record.story_id,
            chapter: bookmark.chapter_id,
            position: bookmark.position,
            note: bookmark.note,
            created_at: bookmark.created_at
          });
        });
      }
    });

    res.json({
      success: true,
      bookmarks: allBookmarks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allBookmarks.length
      }
    });

  } catch (error) {
    console.error('[BookmarkList] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to get bookmarks'
    });
  }
});

/**
 * CRITICAL FIX: Add missing POST route for bookmark creation
 * Route: POST /api/bookmarks
 * Description: Create a new bookmark
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { userId, storyId, chapterId, note = '', position = 0 } = req.body;

    console.log('[BookmarkCreate] Creating bookmark:', { userId, storyId, chapterId, note, position });

    if (!userId || !storyId || !chapterId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'userId, storyId, and chapterId are required'
      });
    }

    // Import required models
    const StoriesReading = require('../models/storiesReading');
    const Chapter = require('../models/chapter');

    // CRITICAL FIX: Fetch chapter data to get chapter_number (required by schema)
    const chapter = await Chapter.findById(chapterId).select('chapter name');
    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: 'Chapter not found',
        message: 'The specified chapter does not exist'
      });
    }

    console.log('[BookmarkCreate] Chapter found:', { chapterId, chapterNumber: chapter.chapter, chapterName: chapter.name });

    // Find or create reading record for this user and story
    let readingRecord = await StoriesReading.findOne({
      user_id: userId,
      story_id: storyId
    });

    if (!readingRecord) {
      // CRITICAL FIX: Create new reading record with required current_chapter field
      readingRecord = new StoriesReading({
        user_id: userId,
        story_id: storyId,
        current_chapter: {
          chapter_id: chapterId,
          chapter_number: chapter.chapter // Required by schema
        },
        bookmarks: [],
        reading_status: 'reading',
        reading_stats: {
          first_read_at: new Date(),
          last_read_at: new Date(),
          completed_chapters: 0,
          total_reading_time: 0
        }
      });
    }

    // Check if bookmark already exists for this chapter
    const existingBookmark = readingRecord.bookmarks?.find(
      bookmark => bookmark.chapter_id && bookmark.chapter_id.toString() === chapterId
    );

    if (existingBookmark) {
      return res.status(409).json({
        success: false,
        error: 'Bookmark already exists',
        message: 'Bạn đã lưu Bookmark cho chapter này rồi'
      });
    }

    // CRITICAL FIX: Add new bookmark with required chapter_number field
    const newBookmark = {
      chapter_id: chapterId,
      chapter_number: chapter.chapter, // Required by StoriesReading schema
      position: parseInt(position) || 0,
      note: note.substring(0, 200), // Limit note length
      created_at: new Date()
    };

    if (!readingRecord.bookmarks) {
      readingRecord.bookmarks = [];
    }

    readingRecord.bookmarks.push(newBookmark);

    // Keep only the latest 10 bookmarks
    if (readingRecord.bookmarks.length > 10) {
      readingRecord.bookmarks = readingRecord.bookmarks
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);
    }

    await readingRecord.save();

    console.log('[BookmarkCreate] Bookmark created successfully');

    res.status(201).json({
      success: true,
      message: 'Bookmark created successfully',
      data: {
        bookmarkId: newBookmark._id,
        bookmark: newBookmark
      }
    });

  } catch (error) {
    console.error('[BookmarkCreate] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to create bookmark'
    });
  }
});

/**
 * Route: DELETE /api/bookmarks/:userId/:storyId/:chapterId
 * Description: Delete a specific bookmark
 */
router.delete('/:userId/:storyId/:chapterId', optionalAuth, async (req, res) => {
  try {
    const { userId, storyId, chapterId } = req.params;

    console.log('[BookmarkDelete] Deleting bookmark:', { userId, storyId, chapterId });

    // Import the storiesReading model
    const StoriesReading = require('../models/storiesReading');

    // Find the reading record
    const readingRecord = await StoriesReading.findOne({
      user_id: userId,
      story_id: storyId
    });

    if (!readingRecord || !readingRecord.bookmarks) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found',
        message: 'No bookmark found for this chapter'
      });
    }

    // Remove the bookmark
    const initialLength = readingRecord.bookmarks.length;
    readingRecord.bookmarks = readingRecord.bookmarks.filter(
      bookmark => bookmark.chapter_id && bookmark.chapter_id.toString() !== chapterId
    );

    if (readingRecord.bookmarks.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found',
        message: 'No bookmark found for this chapter'
      });
    }

    await readingRecord.save();

    console.log('[BookmarkDelete] Bookmark deleted successfully');

    res.json({
      success: true,
      message: 'Đã Xóa Bookmark Thành Công'
    });

  } catch (error) {
    console.error('[BookmarkDelete] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to delete bookmark'
    });
  }
});

module.exports = router;
