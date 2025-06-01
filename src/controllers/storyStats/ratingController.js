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

    // Tìm đánh giá của người dùng
    const userRating = await UserRating.findOne({
      user_id: userObjectId,
      story_id: storyObjectId
    });

    // Tính toán thống kê đánh giá chính xác từ UserRating collection
    // Thay vì aggregate từ StoryStats (có thể bị duplicate)
    const ratingStats = await UserRating.aggregate([
      { $match: { story_id: storyObjectId } },
      {
        $group: {
          _id: null,
          ratingsCount: { $sum: 1 }, // Đếm số lượng user đã rating
          ratingsSum: { $sum: '$rating' }, // Tổng điểm rating
          avgRating: { $avg: '$rating' } // Trung bình rating
        }
      }
    ]);

    // Tính toán đánh giá trung bình
    let averageRating = 0;
    let ratingsCount = 0;
    let ratingsSum = 0;

    if (ratingStats && ratingStats.length > 0) {
      ratingsCount = ratingStats[0].ratingsCount;
      ratingsSum = ratingStats[0].ratingsSum;
      averageRating = ratingStats[0].avgRating;

      // Đảm bảo average_rating không vượt quá 10
      averageRating = Math.min(10, Math.max(0, averageRating));

      // Làm tròn đến 2 chữ số thập phân
      averageRating = Math.round(averageRating * 100) / 100;
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
    console.error('Error in getUserRating:', error);
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

      // Cập nhật StoryStats (chỉ để tracking, không dùng cho tính toán chính xác)
      // Logic này sẽ được đơn giản hóa để tránh duplicate counting
      try {
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
          // Tính toán chính xác từ UserRating collection
          const currentRatingStats = await UserRating.aggregate([
            { $match: { story_id: storyObjectId } },
            {
              $group: {
                _id: null,
                ratingsCount: { $sum: 1 },
                ratingsSum: { $sum: '$rating' }
              }
            }
          ]);

          const currentCount = currentRatingStats.length > 0 ? currentRatingStats[0].ratingsCount : 0;
          const currentSum = currentRatingStats.length > 0 ? currentRatingStats[0].ratingsSum : 0;

          stats = new StoryStats({
            story_id: storyObjectId,
            date: today,
            views: 0,
            unique_views: 0,
            ratings_count: currentCount,
            ratings_sum: currentSum,
            comments_count: 0,
            bookmarks_count: 0,
            shares_count: 0,
            day,
            month,
            year,
            week
          });
        } else {
          // Cập nhật bản ghi hiện có với dữ liệu chính xác từ UserRating
          const currentRatingStats = await UserRating.aggregate([
            { $match: { story_id: storyObjectId } },
            {
              $group: {
                _id: null,
                ratingsCount: { $sum: 1 },
                ratingsSum: { $sum: '$rating' }
              }
            }
          ]);

          const currentCount = currentRatingStats.length > 0 ? currentRatingStats[0].ratingsCount : 0;
          const currentSum = currentRatingStats.length > 0 ? currentRatingStats[0].ratingsSum : 0;

          stats.ratings_count = currentCount;
          stats.ratings_sum = currentSum;
        }

        await stats.save();
      } catch (statsError) {
        // Log lỗi nhưng không fail toàn bộ request
        console.error('Error updating StoryStats:', statsError);
      }

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
