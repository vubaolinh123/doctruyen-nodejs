const express = require('express');
const router = express.Router();
const Chapter = require('../../../models/Chapter');
const Story = require('../../../models/Story');
const mongoose = require('mongoose');

/**
 * @route GET /api/admin/chapters/story/:storyId
 * @desc Lấy danh sách chapter của một truyện cụ thể
 * @access Private (Admin)
 */
router.get('/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;

    // Kiểm tra storyId hợp lệ
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: 'ID truyện không hợp lệ'
      });
    }

    // Kiểm tra truyện tồn tại
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy truyện'
      });
    }

    console.log(`[Admin API] Lấy danh sách chapter của truyện - storyId: ${storyId}`);

    // Kiểm tra xem storyId có phải là ObjectId hợp lệ không
    const storyObjectId = new mongoose.Types.ObjectId(storyId);

    // Lấy tất cả chapter của truyện
    const chapters = await Chapter.find({ story_id: storyObjectId })
      .sort({ chapter: 1 }) // Sắp xếp theo số chương tăng dần
      .lean();

    console.log(`[Admin API] Tìm thấy ${chapters.length} chapter cho truyện ${storyId}`);

    return res.json({
      success: true,
      story,
      chapters,
      total: chapters.length
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

/**
 * @route GET /api/admin/chapters/stories/list
 * @desc Lấy danh sách truyện cho dropdown
 * @access Private (Admin)
 */
router.get('/stories/list', async (req, res) => {
  try {
    // Lấy danh sách truyện với các trường cần thiết
    const stories = await Story.find({}, 'name slug')
      .sort({ name: 1 }) // Sắp xếp theo tên
      .lean();

    return res.json({
      success: true,
      stories
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
});

module.exports = router;
