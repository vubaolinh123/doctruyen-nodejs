const StoryStats = require('../../models/storyStats');
const UserRating = require('../../models/userRating');
const mongoose = require('mongoose');
const moment = require('moment');

/**
 * Lấy đánh giá của người dùng cho truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
exports.getUserRating = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    // Kiểm tra dữ liệu đầu vào
    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu ID truyện'
      });
    }

    // Chuyển đổi storyId và userId thành ObjectId
    const storyObjectId = new mongoose.Types.ObjectId(storyId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Kiểm tra xem có bản ghi UserRating nào trong database không
    const totalRatings = await UserRating.countDocuments();

    // Tìm đánh giá của người dùng
    const userRating = await UserRating.findOne({
      user_id: userObjectId,
      story_id: storyObjectId
    });

    // Lấy thống kê đánh giá của truyện
    const stats = await StoryStats.aggregate([
      { $match: { story_id: storyObjectId } },
      {
        $group: {
          _id: null,
          ratingsCount: { $sum: '$ratings_count' },
          ratingsSum: { $sum: '$ratings_sum' }
        }
      }
    ]);

    // Tính toán đánh giá trung bình
    let averageRating = 0;
    let ratingsCount = 0;
    let ratingsSum = 0;

    if (stats && stats.length > 0) {
      ratingsCount = stats[0].ratingsCount;
      ratingsSum = stats[0].ratingsSum;
      averageRating = ratingsCount > 0 ? ratingsSum / ratingsCount : 0;
    }

    // Trả về kết quả
    return res.status(200).json({
      success: true,
      message: userRating ? 'Lấy đánh giá thành công' : 'Người dùng chưa đánh giá truyện này',
      data: {
        user_rating: userRating ? userRating.rating : null,
        average_rating: averageRating,
        ratings_count: ratingsCount,
        ratings_sum: ratingsSum
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * Đánh giá truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
exports.rateStory = async (req, res) => {
  try {
    const { story_id, rating } = req.body;
    const userId = req.user.id;

    // Kiểm tra dữ liệu đầu vào
    if (!story_id || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin đánh giá'
      });
    }

    // Kiểm tra rating có hợp lệ không (1-10)
    if (rating < 1 || rating > 10 || !Number.isInteger(rating)) {
      return res.status(400).json({
        success: false,
        message: 'Đánh giá phải là số nguyên từ 1 đến 10'
      });
    }

    // Kiểm tra xem người dùng đã đánh giá truyện này chưa
    try {
      // Chuyển đổi story_id và user_id thành ObjectId
      const storyObjectId = new mongoose.Types.ObjectId(story_id);
      const userObjectId = new mongoose.Types.ObjectId(userId);

      // Tìm đánh giá hiện có của người dùng
      const existingRating = await UserRating.findOne({
        user_id: userObjectId,
        story_id: storyObjectId
      });

      // Biến để lưu trữ đánh giá cũ (nếu có)
      let oldRating = 0;
      let isNewRating = true;

      // Xử lý UserRating
      if (existingRating) {
        // Người dùng đã đánh giá trước đó, cập nhật đánh giá
        oldRating = existingRating.rating;
        isNewRating = false;

        // Cập nhật đánh giá
        existingRating.rating = rating;
        await existingRating.save();
      } else {
        // Người dùng chưa đánh giá, tạo đánh giá mới
        const newRating = new UserRating({
          user_id: userObjectId,
          story_id: storyObjectId,
          rating: rating
        });

        await newRating.save();
      }

      // Cập nhật StoryStats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Lấy thông tin ngày, tháng, năm, tuần
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      const week = moment(today).isoWeek();

      // Tìm hoặc tạo bản ghi thống kê cho ngày hôm nay
      let stats = await StoryStats.findOne({
        story_id: storyObjectId,
        date: today
      });

      if (!stats) {
        // Tạo bản ghi mới nếu chưa có
        stats = new StoryStats({
          story_id: storyObjectId,
          date: today,
          views: 0,
          unique_views: 0,
          ratings_count: 1, // Đánh giá đầu tiên
          ratings_sum: rating,
          comments_count: 0,
          bookmarks_count: 0,
          shares_count: 0,
          day,
          month,
          year,
          week
        });
      } else {
        // Cập nhật bản ghi hiện có
        if (isNewRating) {
          // Nếu là đánh giá mới, tăng số lượng đánh giá và tổng điểm đánh giá
          stats.ratings_count += 1;
          stats.ratings_sum += rating;
        } else {
          // Nếu là cập nhật đánh giá, chỉ cập nhật tổng điểm đánh giá
          // Trừ đi điểm cũ và cộng điểm mới
          stats.ratings_sum = stats.ratings_sum - oldRating + rating;
        }
      }

      await stats.save();

      // Trả về kết quả
      return res.status(200).json({
        success: true,
        message: isNewRating ? 'Đánh giá thành công' : 'Cập nhật đánh giá thành công',
        data: {
          story_id,
          rating,
          user_id: userId,
          is_new_rating: isNewRating
        }
      });
    } catch (statsError) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật đánh giá',
        error: statsError.message
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};
